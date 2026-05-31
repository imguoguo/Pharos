import { loadConfig } from './config/index.js';
import { initProviders, getProvider } from './llm/index.js';
import { AgentExecutor } from './agent/executor.js';
import { DiscordBot } from './bot/index.js';
import { startServer } from './server/index.js';

async function main() {
  console.log('[Pharos] Starting...');

  const config = loadConfig();
  initProviders(config.llm.providers);

  const defaultProvider = getProvider(config.llm.defaultProvider);

  const agent = new AgentExecutor({
    provider: defaultProvider,
    sources: config.knowledge.sources,
    timeout: config.agent.timeout,
    maxConcurrency: config.agent.maxConcurrency,
  });

  const bot = new DiscordBot(config.discord, agent);

  startServer({ config, agent, bot });

  if (config.discord.token) {
    await bot.start();
  } else {
    console.log('[Pharos] No Discord token configured, bot not started.');
  }

  process.on('SIGINT', async () => {
    console.log('[Pharos] Shutting down...');
    await bot.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[Pharos] Fatal error:', err);
  process.exit(1);
});
