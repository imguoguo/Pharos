import { Client, GatewayIntentBits, Events, type Message as DiscordMessage } from 'discord.js';
import type { DiscordConfig } from '../types/config.js';
import { AgentExecutor } from '../agent/executor.js';

const REACTION_PROCESSING = '⏳';
const REACTION_DONE = '✅';
const REACTION_ERROR = '❌';
const MAX_MESSAGE_LENGTH = 2000;

export class DiscordBot {
  private client: Client;
  private config: DiscordConfig;
  private agent: AgentExecutor;

  constructor(config: DiscordConfig, agent: AgentExecutor) {
    this.config = config;
    this.agent = agent;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
    this.setupEvents();
  }

  private setupEvents(): void {
    this.client.on(Events.MessageCreate, (message) => this.handleMessage(message));
    this.client.on(Events.ClientReady, () => {
      console.log(`[Pharos] Bot online as ${this.client.user?.tag}`);
    });
  }

  private async handleMessage(message: DiscordMessage): Promise<void> {
    if (message.author.bot) return;
    if (!this.client.user) return;
    if (!message.mentions.has(this.client.user)) return;

    if (this.config.allowedChannels.length > 0 && !this.config.allowedChannels.includes(message.channelId)) {
      return;
    }

    const query = message.content
      .replace(new RegExp(`<@!?${this.client.user.id}>`, 'g'), '')
      .trim();

    if (!query) return;

    await message.react(REACTION_PROCESSING);

    try {
      const task = await this.agent.execute(query, message.channelId, message.author.id, message.id);

      await message.reactions.cache.get(REACTION_PROCESSING)?.users.remove(this.client.user.id);

      if (task.status === 'completed' && task.result) {
        await this.sendChunked(message, task.result);
        await message.react(REACTION_DONE);
      } else {
        await message.reply(task.error ?? 'An error occurred while processing your question.');
        await message.react(REACTION_ERROR);
      }
    } catch (err) {
      await message.reactions.cache.get(REACTION_PROCESSING)?.users.remove(this.client.user.id);
      await message.react(REACTION_ERROR);
      await message.reply('Internal error occurred.');
      console.error('[Pharos] Error handling message:', err);
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
    await this.client.login(this.config.token);
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
