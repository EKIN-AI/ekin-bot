import { octokit, GH_ORG } from '../config.mjs';
import { syncSessionToGitHub, userSession } from '../session.mjs';
import { BaseModule } from './BaseModule.mjs';

export class ProjectModule extends BaseModule {
  constructor() {
    super('📂 Project Management');
    this.setupCommands();
  }

  setupCommands() {
    this.addCommand('projects', 'List all private repositories in the Ekin-AI organization.', async (ctx) => {
      console.log('📂 [COMMAND] /projects');
      try {
        const { data: repos } = await octokit.rest.repos.listForOrg({
          org: GH_ORG,
          type: 'private',
          sort: 'updated'
        });

        const list = repos.map(r => `• ${r.name}`).join('\n');
        ctx.reply(`📂 Ekin-AI Repositories:\n\n${list}\n\nUse /select <name> to manage one.`);
      } catch (err) {
        ctx.reply(`❌ Error listing repos: ${err.message}`);
      }
    });

    this.addCommand('select', 'Select a project repository to work on (Synced to IDE).', async (ctx) => {
      console.log('📂 [COMMAND] /select');
      const repoName = ctx.message.text.split(' ')[1];
      if (!repoName) return ctx.reply('❓ Please specify a repository name. Example: /select app1');

      await syncSessionToGitHub(ctx.from.id, repoName);
      ctx.reply(`🎯 Selected project: ${repoName}.\n\nThis selection is now synchronized with your IDE Cockpit! (Synced to GitHub)`);
    });

    this.addCommand('kickoff', 'Initialize a new project repository and signal the IDE agent.', async (ctx) => {
      const projectName = ctx.message.text.replace('/kickoff ', '').trim();

      if (!projectName || projectName === '/kickoff') {
        return ctx.reply('❓ Please specify a project name. Example: /kickoff ekin-portal');
      }

      const validName = /^[a-z0-9-]+$/.test(projectName);
      if (!validName) return ctx.reply('❌ Invalid project name. Use lowercase, numbers, and dashes only.');

      try {
        const { data: newRepo } = await octokit.rest.repos.createInOrg({
          org: GH_ORG,
          name: projectName,
          private: true,
          auto_init: true,
          description: `Requirements Phase: Project Kickoff for ${projectName}`
        });

        await octokit.rest.issues.create({
          owner: GH_ORG,
          repo: 'ekin-ai-shell',
          title: `[KICKOFF] ${projectName}`,
          labels: ['status:kickoff-pending'],
          body: JSON.stringify({
            project_name: projectName,
            repo_url: newRepo.html_url,
            requested_by: ctx.from.username || ctx.from.id,
            phase: 'Requirements Gathering',
            timestamp: new Date().toISOString()
          }, null, 2)
        });

        ctx.reply(`🏁 KICKOFF INITIATED: ${projectName}\n\nRepo: ${newRepo.html_url}\nPhase: Requirements Gathering\n\nYour IDE Agent has been signaled to begin the discovery workshop!`);
      } catch (err) {
        ctx.reply(`❌ Error during kickoff: ${err.message}`);
      }
    });

    this.addCommand('bootstrap', 'Request infrastructure setup (Vault, Postgres, etc.) for the selected repo.', async (ctx) => {
      const session = userSession[ctx.from.id];
      const projectName = session?.selectedRepo;
      if (!projectName) return ctx.reply('🛑 No project selected. Use /select <name> first.');

      const services = ctx.message.text.split(' ').slice(1).join(', ') || 'standard-stack';

      try {
        const { data: issue } = await octokit.rest.issues.create({
          owner: GH_ORG,
          repo: 'ekin-ai-shell',
          title: `[BOOTSTRAP] ${projectName}`,
          labels: ['status:bootstrap-pending'],
          body: JSON.stringify({
            project_name: projectName,
            requested_services: services,
            requested_by: ctx.from.username || ctx.from.id,
            timestamp: new Date().toISOString()
          }, null, 2)
        });

        ctx.reply(`🏗️ BOOTSTRAP REQUESTED: ${projectName}\n\nServices: ${services}\nIssue: ${issue.html_url}\n\nYour local Antigravity engine has been signaled. Please confirm the setup in your IDE.`);
      } catch (err) {
        ctx.reply(`❌ Error requesting bootstrap: ${err.message}`);
      }
    });
  }
}
