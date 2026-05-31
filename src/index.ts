import { loadConfig, appendLog } from './config/index.js';
import { initProviders, getProvider } from './llm/index.js';
import { AgentExecutor } from './agent/executor.js';
import { DiscordBot } from './bot/index.js';
import { startServer } from './server/index.js';
import { refreshSchedules } from './services/scheduler.js';

// Allow self-signed / corporate proxy certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function main() {
  console.log('[Pharos] Starting...');
  appendLog('info', 'Pharos starting');

  const config = loadConfig();
  initProviders(config.llm.providers);

  const defaultProvider = config.llm.defaultProvider
    ? getProvider(config.llm.defaultProvider)
    : null;

  const agent = new AgentExecutor({
    provider: defaultProvider!,
    sources: config.projects.flatMap((p) => p.sources),
    timeout: config.agent.timeout,
    maxConcurrency: config.agent.maxConcurrency,
  });

  const bot = new DiscordBot(config.discord, agent, config.projects, config);

  refreshSchedules(config);
  startServer({ config, agent, bot });

  if (config.discord.token) {
    bot.start().then(() => {
      appendLog('info', 'Discord bot started');
    }).catch((err) => {
      console.error('[Pharos] Bot failed to start:', err.message);
      appendLog('error', `Bot start failed: ${err.message}`);
    });
  } else {
    console.log('[Pharos] No Discord token configured, bot not started.');
  }

  process.on('SIGINT', async () => {
    console.log('[Pharos] Shutting down...');
    appendLog('info', 'Pharos shutting down');
    await bot.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[Pharos] Fatal error:', err);
  console.error('[Pharos] Stack:', err.stack);
  appendLog('error', `Fatal: ${err.message}`);
  process.exit(1);
});
