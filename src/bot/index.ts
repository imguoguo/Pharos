import { Client, GatewayIntentBits, Events, type Message as DiscordMessage } from 'discord.js';
import type { AppConfig, DiscordConfig, Project, ProgressVerbosity } from '../types/config.js';
import { AgentExecutor, type StepCallback } from '../agent/executor.js';
import { appendHistory, appendLog } from '../config/index.js';
import type { AgentStep, ConversationEntry } from '../types/agent.js';
import { handleAdminCommand } from './commands.js';
import { randomUUID } from 'crypto';

const REACTION_PROCESSING = '⏳';
const REACTION_DONE = '✅';
const REACTION_ERROR = '❌';
const MAX_MESSAGE_LENGTH = 2000;

const ADMIN_PREFIXES = ['project ', 'repo ', 'source ', 'help', '/help', '/project', '/repo', '/source'];

export class DiscordBot {
  private client: Client;
  private discordConfig: DiscordConfig;
  private appConfig: AppConfig;
  private agent: AgentExecutor;
  private projects: Project[];

  constructor(config: DiscordConfig, agent: AgentExecutor, projects: Project[], appConfig: AppConfig) {
    this.discordConfig = config;
    this.appConfig = appConfig;
    this.agent = agent;
    this.projects = projects;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
    this.setupEvents();
  }

  updateProjects(projects: Project[]): void {
    this.projects = projects;
  }

  private setupEvents(): void {
    this.client.on(Events.MessageCreate, (message) => this.handleMessage(message));
    this.client.on(Events.ClientReady, () => {
      console.log(`[Pharos] Bot online as ${this.client.user?.tag}`);
      appendLog('info', `Bot online as ${this.client.user?.tag}`);
    });
  }

  private findProjectForChannel(channelId: string): Project | undefined {
    return this.projects.find((p) => p.channels.includes(channelId));
  }

  private getMemberRoleIds(message: DiscordMessage): string[] {
    return message.member?.roles.cache.map((r) => r.id) ?? [];
  }

  private getVerbosity(): ProgressVerbosity {
    return this.appConfig.agent.progressVerbosity || 'progress';
  }

  private async handleMessage(message: DiscordMessage): Promise<void> {
    if (message.author.bot) return;
    if (!this.client.user) return;

    const isDM = !message.guildId;
    const mentionsBot = message.mentions.has(this.client.user);

    if (!mentionsBot && !isDM) return;

    const query = message.content
      .replace(new RegExp(`<@!?${this.client.user.id}>`, 'g'), '')
      .trim();

    if (!query) return;

    const lowerQuery = query.toLowerCase();
    const isAdminCmd = ADMIN_PREFIXES.some((p) => lowerQuery.startsWith(p));

    if (isAdminCmd || isDM) {
      const roleIds = this.getMemberRoleIds(message);
      const result = await handleAdminCommand(
        query,
        message.author.id,
        roleIds,
        message.channelId,
        message.guildId ?? '',
        isDM,
        this.appConfig,
      );
      if (result) {
        await message.reply(result.reply);
        return;
      }
      if (isDM) return;
    }

    const project = this.findProjectForChannel(message.channelId);
    if (!project) {
      await message.reply('This channel is not linked to any project. Use `help` to see available commands.');
      return;
    }

    const verbosity = this.getVerbosity();
    let progressMsg: DiscordMessage | null = null;

    if (verbosity !== 'silent') {
      progressMsg = await message.reply('⏳ Thinking...');
    } else {
      await message.react(REACTION_PROCESSING);
    }

    const startTime = Date.now();
    let stepCount = 0;

    const onStep: StepCallback | undefined = verbosity === 'silent' ? undefined : async (step) => {
      if (!progressMsg) return;
      stepCount++;
      try {
        const statusText = this.formatProgress(step, stepCount, verbosity);
        await progressMsg.edit(statusText);
      } catch {
        // message may have been deleted
      }
    };

    try {
      const task = await this.agent.execute(
        query,
        message.channelId,
        message.author.id,
        message.id,
        project.id,
        project.sources.filter((s) => s.enabled),
        onStep,
      );

      if (verbosity === 'silent') {
        await message.reactions.cache.get(REACTION_PROCESSING)?.users.remove(this.client.user.id);
      }

      if (task.status === 'completed' && task.result) {
        if (progressMsg) {
          await progressMsg.delete().catch(() => {});
        }
        await this.sendChunked(message, task.result, true);
        await message.react(REACTION_DONE);

        const entry: ConversationEntry = {
          id: randomUUID(),
          channelId: message.channelId,
          guildId: message.guildId ?? '',
          userId: message.author.id,
          username: message.author.username,
          query,
          response: task.result,
          providerId: '',
          projectId: project.id,
          tokensUsed: 0,
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          steps: task.steps,
        };
        appendHistory(entry);
      } else {
        const errMsg = task.error ?? 'An error occurred while processing your question.';
        if (progressMsg) {
          await progressMsg.edit(errMsg);
        } else {
          await message.reply(errMsg);
        }
        await message.react(REACTION_ERROR);
      }
    } catch (err) {
      if (verbosity === 'silent') {
        await message.reactions.cache.get(REACTION_PROCESSING)?.users.remove(this.client.user.id);
      }
      if (progressMsg) {
        await progressMsg.edit('Internal error occurred.').catch(() => {});
      } else {
        await message.reply('Internal error occurred.');
      }
      await message.react(REACTION_ERROR);
      appendLog('error', `Message handling error: ${err}`);
    }
  }

  private formatProgress(step: AgentStep, count: number, verbosity: ProgressVerbosity): string {
    if (verbosity === 'detailed') {
      if (step.type === 'tool_call') {
        return `⏳ Step ${count}: calling \`${step.toolName}\`\n\`\`\`${JSON.stringify(step.toolArgs, null, 2).slice(0, 300)}\`\`\``;
      }
      if (step.type === 'tool_result') {
        const preview = step.content.slice(0, 500).replace(/```/g, '\\`\\`\\`');
        return `⏳ Step ${count}: \`${step.toolName}\` returned\n\`\`\`${preview}\`\`\``;
      }
      return `⏳ Step ${count}: thinking...`;
    }

    if (step.type === 'tool_call') {
      return `⏳ Exploring... (step ${count}: ${step.toolName})`;
    }
    if (step.type === 'llm_call') {
      return `⏳ Analyzing... (step ${count})`;
    }
    return `⏳ Processing... (step ${count})`;
  }

  private async sendChunked(message: DiscordMessage, content: string, asReply: boolean): Promise<void> {
    const chunks = this.splitContent(content);
    for (let i = 0; i < chunks.length; i++) {
      if (i === 0 && asReply) {
        await message.reply(chunks[i]);
      } else {
        await message.channel.send(chunks[i]);
      }
    }
  }

  private splitContent(content: string): string[] {
    const cleaned = content.replace(/^-{3,}$/gm, '').replace(/^_{3,}$/gm, '');
    if (cleaned.length <= MAX_MESSAGE_LENGTH) return [cleaned];

    const chunks: string[] = [];
    let remaining = cleaned;
    while (remaining.length > 0) {
      if (remaining.length <= MAX_MESSAGE_LENGTH) {
        chunks.push(remaining);
        break;
      }

      const slice = remaining.slice(0, MAX_MESSAGE_LENGTH);
      const inCodeBlock = (slice.match(/```/g) || []).length % 2 === 1;

      let splitAt = -1;
      if (!inCodeBlock) {
        splitAt = remaining.lastIndexOf('\n## ', MAX_MESSAGE_LENGTH);
        if (splitAt === -1 || splitAt < 200) {
          splitAt = remaining.lastIndexOf('\n\n', MAX_MESSAGE_LENGTH);
        }
        if (splitAt === -1 || splitAt < 200) {
          splitAt = remaining.lastIndexOf('\n', MAX_MESSAGE_LENGTH);
        }
        if (splitAt === -1 || splitAt < 200) {
          splitAt = remaining.lastIndexOf('. ', MAX_MESSAGE_LENGTH);
          if (splitAt !== -1) splitAt += 1;
        }
      }

      if (inCodeBlock || splitAt === -1 || splitAt < 200) {
        const closeIdx = remaining.indexOf('\n```', 100);
        if (inCodeBlock && closeIdx !== -1 && closeIdx < MAX_MESSAGE_LENGTH - 10) {
          splitAt = closeIdx + 4;
        } else if (inCodeBlock) {
          splitAt = remaining.lastIndexOf('\n', MAX_MESSAGE_LENGTH);
          if (splitAt === -1 || splitAt < 200) splitAt = MAX_MESSAGE_LENGTH;
          chunks.push(remaining.slice(0, splitAt) + '\n```');
          remaining = '```\n' + remaining.slice(splitAt).trimStart();
          continue;
        } else {
          splitAt = MAX_MESSAGE_LENGTH;
        }
      }

      chunks.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt).trimStart();
    }
    return chunks;
  }

  async start(): Promise<void> {
    await this.client.login(this.discordConfig.token);
  }

  async stop(): Promise<void> {
    this.client.destroy();
  }

  getStatus(): { online: boolean; username?: string; guilds: number } {
    return {
      online: this.client.isReady(),
      username: this.client.user?.tag,
      guilds: this.client.guilds.cache.size,
    };
  }
}
