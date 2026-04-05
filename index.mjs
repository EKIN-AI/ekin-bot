import { Telegraf } from 'telegraf';
import { BOT_TOKEN, ALLOWED_ID } from './src/config.mjs';
import { loadSessionFromGitHub } from './src/session.mjs';
import { registry } from './src/registry.mjs';

// Module Imports
import { ProjectModule } from './src/modules/project.mjs';
import { DiscoveryModule } from './src/modules/discovery.mjs';
import { OrchestrationModule } from './src/modules/orchestration.mjs';
import { PersonaModule } from './src/modules/persona.mjs';

console.log('🚀 Antigravity Bot: Launching Modular Orchestrator...');

const bot = new Telegraf(BOT_TOKEN);

// 🛡️ Global Middleware: Lockdown & Logging
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;
  const username = ctx.from?.username || 'unknown';
  const text = ctx.message?.text || '[non-text message]';

  console.log(`📩 [IN] from=${username} (${userId}), text="${text}"`);

  if (ALLOWED_ID && String(userId) !== String(ALLOWED_ID)) {
    console.warn(`🛑 [BLOCKED] Unauthorized ID: ${userId}`);
    return;
  }
  
  return next();
});

// 🏗️ Command Registration
registry.registerModule(new ProjectModule());
registry.registerModule(new DiscoveryModule());
registry.registerModule(new OrchestrationModule());
registry.registerModule(new PersonaModule());

// Wiring everything to Telegraf
registry.registerWithBot(bot);

// 🚀 Boot Sequence
(async () => {
  try {
    await loadSessionFromGitHub();
    await bot.launch();
    console.log('✅ Ekin Bot Orchestrator is ONLINE (Modular Architecture)');
  } catch (err) {
    console.error('❌ Launch Error:', err);
    process.exit(1);
  }
})();

// Graceful Shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
