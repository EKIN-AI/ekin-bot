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

        // 🔄 DISPATCH PATTERN: Drop a lightweight notification ticket into the central shell queue.
        // This acts as a trigger for the local AI poller daemon, pointing it to the real task details.
        await octokit.rest.issues.create({
          owner: GH_ORG,
          repo: 'ekin-ai-shell',
          title: `[DISPATCH] New feature in ${selectedRepo}`,
          labels: ['status:dispatch-pending'],
          body: `A new feature was created in ${selectedRepo}. Please process it: ${issue.html_url}`
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

    this.addCommand('epics', 'List all strategic Epics from the live GitHub issue backlog.', async (ctx) => {
      const repo = userSession[ctx.from.id]?.selectedRepo;
      if (!repo) return ctx.reply('🛑 No project selected.');

      try {
        const { data: issues } = await octokit.rest.issues.listForRepo({
          owner: GH_ORG,
          repo,
          labels: 'epic',
          state: 'all'
        });

        if (issues.length === 0) return ctx.reply(`📭 No Epics found in [${repo}]. Use /sync to import from documentation.`);

        let report = `🏛️ **Project Epics: ${repo}**\n\n`;
        issues.forEach((epic, i) => report += `${i + 1}. ${epic.title} (#${epic.number})\n`);
        report += `\nUse /features <name> to drill down.`;
        ctx.replyWithMarkdown(report);
      } catch (err) {
        ctx.reply(`❌ Error fetching Epics: ${err.message}`);
      }
    });

    this.addCommand('features', 'List all Features associated with an Epic from GitHub Issues.', async (ctx) => {
      const repo = userSession[ctx.from.id]?.selectedRepo;
      const epicQuery = ctx.message.text.split(' ').slice(1).join(' ').trim();
      if (!repo || !epicQuery) return ctx.reply('❓ Please specify an Epic name. Example: /features Authn');

      try {
        const { data: issues } = await octokit.rest.issues.listForRepo({
          owner: GH_ORG,
          repo,
          labels: 'feature',
          state: 'all'
        });

        const filtered = issues.filter(iss => 
          iss.title.toLowerCase().includes(epicQuery.toLowerCase()) || 
          iss.body?.toLowerCase().includes(epicQuery.toLowerCase())
        );

        if (filtered.length === 0) return ctx.reply(`📭 No features found linked to Epic: "${epicQuery}"`);

        let report = `🧩 **Features for Epic: ${epicQuery}**\n\n`;
        filtered.forEach((feat, i) => report += `${i + 1}. ${feat.title} (#${feat.number})\n`);
        report += `\nUse /stories <name> for user impact.`;
        ctx.replyWithMarkdown(report);
      } catch (err) {
        ctx.reply(`❌ Error fetching features: ${err.message}`);
      }
    });

    this.addCommand('stories', 'View User Stories for a specific Feature from GitHub Issues.', async (ctx) => {
      const repo = userSession[ctx.from.id]?.selectedRepo;
      const featQuery = ctx.message.text.split(' ').slice(1).join(' ').trim();
      if (!repo || !featQuery) return ctx.reply('❓ Please specify a Feature name.');

      try {
        const { data: issues } = await octokit.rest.issues.listForRepo({
          owner: GH_ORG,
          repo,
          labels: 'story',
          state: 'all'
        });

        const filtered = issues.filter(iss => 
          iss.title.toLowerCase().includes(featQuery.toLowerCase()) || 
          iss.body?.toLowerCase().includes(featQuery.toLowerCase())
        );

        if (filtered.length === 0) return ctx.reply(`📭 No user stories found for: "${featQuery}"`);

        let report = `📖 **User Stories: ${featQuery}**\n\n`;
        filtered.forEach((story, i) => report += `• ${story.title} (#${story.number})\n`);
        ctx.replyWithMarkdown(report);
      } catch (err) {
        ctx.reply(`❌ Error fetching stories: ${err.message}`);
      }
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

    this.addCommand('questions', 'List all pending Human-in-Loop questions and project uncertainties.', async (ctx) => {
      const repo = userSession[ctx.from.id]?.selectedRepo;
      if (!repo) return ctx.reply('🛑 No project selected.');

      try {
        const { data: issues } = await octokit.rest.issues.listForRepo({
          owner: GH_ORG,
          repo,
          labels: 'question',
          state: 'open'
        });

        if (issues.length === 0) return ctx.reply(`✅ No pending questions found for [${repo}].`);

        let report = `❓ **Open Questions: ${repo}**\n\n`;
        issues.forEach((q, i) => {
          report += `${i + 1}. [#${q.number}] ${q.title}\n`;
        });
        report += `\nUse \`/task <#ID>\` to view details or answer on GitHub.`;
        ctx.replyWithMarkdown(report);
      } catch (err) {
        ctx.reply(`❌ Error fetching questions: ${err.message}`);
      }
    });
  }
}
