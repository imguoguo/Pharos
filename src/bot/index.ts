import { Client, GatewayIntentBits, Events, type Message as DiscordMessage } from 'discord.js';
import type { AppConfig, DiscordConfig, Project } from '../types/config.js';
import { AgentExecutor } from '../agent/executor.js';
import { appendHistory, appendLog } from '../config/index.js';
import type { ConversationEntry } from '../types/agent.js';
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
    if (!project) return;

    await message.react(REACTION_PROCESSING);
    const startTime = Date.now();

    try {
      const task = await this.agent.execute(
        query,
        message.channelId,
        message.author.id,
        message.id,
        project.id,
        project.sources.filter((s) => s.enabled),
      );

      await message.reactions.cache.get(REACTION_PROCESSING)?.users.remove(this.client.user.id);

      if (task.status === 'completed' && task.result) {
        await this.sendChunked(message, task.result);
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
        };
        appendHistory(entry);
      } else {
        await message.reply(task.error ?? 'An error occurred while processing your question.');
        await message.react(REACTION_ERROR);
      }
    } catch (err) {
      await message.reactions.cache.get(REACTION_PROCESSING)?.users.remove(this.client.user.id);
      await message.react(REACTION_ERROR);
      await message.reply('Internal error occurred.');
      appendLog('error', `Message handling error: ${err}`);
    }
  }

  private async sendChunked(message: DiscordMessage, content: string): Promise<void> {
    if (content.length <= MAX_MESSAGE_LENGTH) {
      await message.reply(content);
      return;
    }

    const chunks: string[] = [];
    let remaining = content;
    while (remaining.length > 0) {
      if (remaining.length <= MAX_MESSAGE_LENGTH) {
        chunks.push(remaining);
        break;
      }
      let splitAt = remaining.lastIndexOf('\n', MAX_MESSAGE_LENGTH);
      if (splitAt === -1 || splitAt < MAX_MESSAGE_LENGTH / 2) {
        splitAt = MAX_MESSAGE_LENGTH;
      }
      chunks.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt);
    }

    for (let i = 0; i < chunks.length; i++) {
      if (i === 0) {
        await message.reply(chunks[i]);
      } else {
        await message.channel.send(chunks[i]);
      }
    }
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
