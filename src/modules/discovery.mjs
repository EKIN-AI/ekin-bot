import { octokit, GH_ORG } from '../config.mjs';
import { userSession } from '../session.mjs';
import { getRepoFile, parseDiscoveryHierarchy } from '../helpers.mjs';
import { BaseModule } from './BaseModule.mjs';

export class DiscoveryModule extends BaseModule {
  constructor() {
    super('🔭 Discovery & Requirements');
    this.setupCommands();
  }

  setupCommands() {
    this.addCommand('feature', 'Create a new feature issue in the selected repository.', async (ctx) => {
      const session = userSession[ctx.from.id];
      const selectedRepo = session?.selectedRepo;
      if (!selectedRepo) return ctx.reply('🛑 No project selected. Use /select <name> first.');

      const title = ctx.message.text.replace('/feature ', '').trim();
      if (!title || title === '/feature') return ctx.reply('❓ Please provide a title. Example: /feature Implement Login UI');

      try {
        const { data: issue } = await octokit.rest.issues.create({
          owner: GH_ORG,
          repo: selectedRepo,
          title: title,
          assignees: ['ekininnovations-yad']
        });

        ctx.reply(`✅ Created Feature: "${title}"\n🔗 ${issue.html_url}`);
      } catch (err) {
        ctx.reply(`❌ Error creating feature: ${err.message}`);
      }
    });

    this.addCommand('requirements', 'View strategic vision, objectives, and success metrics for the project.', async (ctx) => {
      const repo = userSession[ctx.from.id]?.selectedRepo;
      if (!repo) return ctx.reply('🛑 No project selected.');

      const content = await getRepoFile(repo, 'docs/requirements/initial_discovery.md');
      if (!content) return ctx.reply(`📭 No discovery heart found for [${repo}]. Please /kickoff first.`);

      try {
        const visionMatch = content.match(/## 💡 Vision & Core Value\s+([\s\S]*?)\s+---/);
        const objectiveMatch = content.match(/## 🎯 Strategic Objectives\s+([\s\S]*?)\s+(?:---|\n#)/);
        const metricsMatch = content.match(/## 📊 Success Metrics\s+([\s\S]*?)\s+(?:---|\n#)/);

        let report = `🔭 **Project Vision: ${repo}**\n\n${visionMatch ? visionMatch[1].trim() : '_Vision in synthesis..._'}\n\n`;
        if (objectiveMatch) report += `🎯 **Strategic Objectives**:\n${objectiveMatch[1].trim()}\n\n`;
        if (metricsMatch) report += `📊 **Success Metrics**:\n${metricsMatch[1].trim()}\n\n`;

        report += `Use /roadmap to see the phase lifecycle.`;
        ctx.replyWithMarkdown(report);
      } catch (err) {
        ctx.reply('❌ Error parsing project vision.');
      }
    });

    this.addCommand('roadmap', 'View the project phase roadmap and lifecycle.', async (ctx) => {
      const repo = userSession[ctx.from.id]?.selectedRepo;
      if (!repo) return ctx.reply('🛑 No project selected.');

      const content = await getRepoFile(repo, 'docs/requirements/initial_discovery.md');
      if (!content) return ctx.reply('📭 No discovery doc found.');

      try {
        const roadmapSection = content.match(/## 🚀 Phase Roadmap\s+([\s\S]*?)($|---|\n#)/);
        const phases = roadmapSection ? roadmapSection[1].trim() : '_Roadmap in architecture..._';

        let report = `🚀 **Phase Roadmap: ${repo}**\n\n${phases}\n\nUse /epics to drill down into the work pillars.`;
        ctx.replyWithMarkdown(report);
      } catch (err) {
        ctx.reply('❌ Error parsing roadmap.');
      }
    });

    this.addCommand('epics', 'List all strategic Epics defined for the current project.', async (ctx) => {
      const repo = userSession[ctx.from.id]?.selectedRepo;
      if (!repo) return ctx.reply('🛑 No project selected.');

      const content = await getRepoFile(repo, 'docs/requirements/initial_discovery.md');
      if (!content) return ctx.reply('📭 No roadmap found.');

      const epics = parseDiscoveryHierarchy(content, 1);
      let report = `🏛️ **Project Epics: ${repo}**\n\n`;
      epics.forEach((epic, i) => report += `${i + 1}. ${epic}\n`);
      report += `\nUse /features <name> to drill down.`;
      ctx.replyWithMarkdown(report);
    });

    this.addCommand('features', 'List all Features associated with a specific Epic.', async (ctx) => {
      const repo = userSession[ctx.from.id]?.selectedRepo;
      const epicQuery = ctx.message.text.split(' ').slice(1).join(' ').trim();
      if (!repo || !epicQuery) return ctx.reply('❓ Please specify an Epic name. Example: /features Authn');

      const content = await getRepoFile(repo, 'docs/requirements/initial_discovery.md');
      const features = parseDiscoveryHierarchy(content, 2, epicQuery);
      if (features.length === 0) return ctx.reply(`📭 No features found for Epic: "${epicQuery}"`);

      let report = `🧩 **Features for Epic: ${epicQuery}**\n\n`;
      features.forEach((feat, i) => report += `${i + 1}. ${feat}\n`);
      report += `\nUse /stories <name> for user impact.`;
      ctx.replyWithMarkdown(report);
    });

    this.addCommand('stories', 'View User Stories for a specific Feature.', async (ctx) => {
      const repo = userSession[ctx.from.id]?.selectedRepo;
      const featQuery = ctx.message.text.split(' ').slice(1).join(' ').trim();
      if (!repo || !featQuery) return ctx.reply('❓ Please specify a Feature name.');

      const content = await getRepoFile(repo, 'docs/requirements/initial_discovery.md');
      const stories = parseDiscoveryHierarchy(content, 3, featQuery);
      if (stories.length === 0) return ctx.reply(`📭 No user stories found for: "${featQuery}"`);

      let report = `📖 **User Stories: ${featQuery}**\n\n`;
      stories.forEach((story, i) => report += `• ${story}\n`);
      ctx.replyWithMarkdown(report);
    });

    this.addCommand('task', 'Get detailed status and info for a specific GitHub Issue.', async (ctx) => {
      const repo = userSession[ctx.from.id]?.selectedRepo;
      const taskNum = ctx.message.text.split(' ')[1];
      if (!repo || !taskNum) return ctx.reply('❓ Please specify a task number. Example: /task 1');

      try {
        const { data: issue } = await octokit.rest.issues.get({
          owner: GH_ORG,
          repo,
          issue_number: parseInt(taskNum)
        });

        let report = `🎫 **Task #${issue.number}: ${issue.title}**\n`;
        report += `Status: ${issue.state === 'open' ? '⏳ In-Progress' : '✅ Done'}\n`;
        report += `Labels: ${issue.labels.map(l => l.name).join(', ') || 'none'}\n`;
        report += `\n🔗 [View on GitHub](${issue.html_url})`;
        ctx.replyWithMarkdown(report);
      } catch (err) {
        ctx.reply(`❌ Could not find Task #${taskNum} in ${repo}.`);
      }
    });
  }
}
