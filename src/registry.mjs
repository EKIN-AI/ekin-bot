export class CommandRegistry {
  constructor() {
    this.modules = [];
    this.commands = new Map();
  }

  /**
   * Add a CommandModule and register its commands to the registry.
   * @param {BaseModule} module 
   */
  registerModule(module) {
    this.modules.push(module);
    module.getCommands().forEach(cmd => {
      this.commands.set(cmd.command, cmd);
    });
  }

  /**
   * Register all modules and specialized help with the Telegraf bot instance.
   * @param {import('telegraf').Telegraf} bot 
   */
  registerWithBot(bot) {
    // 1. Register Action Commands
    this.commands.forEach((cmd, name) => {
      bot.command(name, cmd.action);
    });

    // 2. Global Help command
    bot.help((ctx) => this.showHelp(ctx));
    bot.command('help', (ctx) => {
      const q = ctx.message.text.split(' ')[1];
      if (q) return this.showCommandHelp(ctx, q);
      this.showHelp(ctx);
    });

    // 3. Fallback for Unknown Commands
    bot.on('text', (ctx, next) => {
      const text = ctx.message.text;
      if (text.startsWith('/')) {
        const cmdName = text.split(' ')[0].slice(1);
        if (!this.commands.has(cmdName)) {
          return ctx.reply(`⚠️ Unknown command: /${cmdName}\n\n` + this.getHelpSummary());
        }
      }
      return next();
    });
  }

  getHelpSummary() {
    let summary = "🚀 **Permissible Commands**\n\n";
    this.modules.forEach(mod => {
      summary += `**${mod.name}**\n`;
      mod.getCommands().forEach(cmd => {
        summary += `/ ${cmd.command}\n`;
      });
      summary += "\n";
    });
    summary += "Use `/help` for detailed documentation.";
    return summary;
  }

  showHelp(ctx) {
    ctx.replyWithMarkdown(this.getHelpSummary());
  }

  showCommandHelp(ctx, name) {
    // Basic lookup for command-specific help
    const cmd = this.commands.get(name);
    if (!cmd) return ctx.reply(`❓ Command \`${name}\` not found.`);
    
    let report = `💡 **Help: /${cmd.command}**\n\n${cmd.description}\n\n`;
    report += `_Orchestration Rule: Every task requires an Epic -> Feature -> Story chain._`;
    
    ctx.replyWithMarkdown(report);
  }
}

export const registry = new CommandRegistry();
