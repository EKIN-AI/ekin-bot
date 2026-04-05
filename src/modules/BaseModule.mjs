export class BaseModule {
  constructor(name) {
    this.name = name;
    this.commands = [];
  }

  /**
   * Register a command with metadata for the help system.
   * @param {string} command The command string (e.g., 'start') 
   * @param {string} description Brief description for the help list
   * @param {function} action The async function (ctx) => { ... }
   */
  addCommand(command, description, action) {
    this.commands.push({ command, description, action });
  }

  getCommands() {
    return this.commands;
  }
}
