import { octokit, graphqlWithAuth, GH_ORG } from '../config.mjs';
import { userSession } from '../session.mjs';
import { BaseModule } from './BaseModule.mjs';

export class OrchestrationModule extends BaseModule {
  constructor() {
    super('⚙️ Orchestration & Execution');
    this.setupCommands();
  }

  setupCommands() {
    this.addCommand('next', 'Calculate and suggest the next highest value/priority task.', async (ctx) => {
      const session = userSession[ctx.from.id];
      const selectedRepo = session?.selectedRepo;
      if (!selectedRepo) return ctx.reply('🛑 No project selected. Use /select <name> first.');

      try {
        const { organization } = await graphqlWithAuth(`
          query getProjectPriority($org: String!) {
            organization(login: $org) {
              projectsV2(first: 1) {
                nodes {
                  id
                  title
                  items(first: 50) {
                    nodes {
                      content {
                        ... on Issue { title number labels(first: 5) { nodes { name } } }
                      }
                      fieldValues(first: 20) {
                        nodes {
                          ... on ProjectV2ItemFieldSingleSelectValue {
                            name
                            field { ... on ProjectV2SingleSelectField { name } }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        `, { org: GH_ORG });

        const project = organization.projectsV2.nodes[0];
        const items = project?.items.nodes.filter(i => i.content?.title) || [];

        const priorityMap = { 'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3, 'New': 4 };
        const valueMap = { 'High': 0, 'Medium': 1, 'Low': 2 };
        const complexityMap = { 'Low': 0, 'Medium': 1, 'High': 2 };

        const sortedItems = items.sort((a, b) => {
          const aPrio = priorityMap[a.fieldValues.nodes.find(f => f.field?.name === 'Priority')?.name] ?? 99;
          const bPrio = priorityMap[b.fieldValues.nodes.find(f => f.field?.name === 'Priority')?.name] ?? 99;
          if (aPrio !== bPrio) return aPrio - bPrio;
          const aVal = valueMap[a.fieldValues.nodes.find(f => f.field?.name === 'Business Value')?.name] ?? 99;
          const bVal = valueMap[b.fieldValues.nodes.find(f => f.field?.name === 'Business Value')?.name] ?? 99;
          if (aVal !== bVal) return aVal - bVal;
          const aComp = complexityMap[a.fieldValues.nodes.find(f => f.field?.name === 'Complexity')?.name] ?? 99;
          const bComp = complexityMap[b.fieldValues.nodes.find(f => f.field?.name === 'Complexity')?.name] ?? 99;
          return aComp - bComp;
        });

        const nextTask = sortedItems[0];
        if (!nextTask) return ctx.reply('✅ No tasks found in the queue!');

        const prio = nextTask.fieldValues.nodes.find(f => f.field?.name === 'Priority')?.name || 'None';
        const val = nextTask.fieldValues.nodes.find(f => f.field?.name === 'Business Value')?.name || 'None';
        ctx.reply(`🎯 AGENTIC TARGET (High Value/Priority):\n\n[Prio: ${prio}][Value: ${val}] ${nextTask.content.title}\nIssue #${nextTask.content.number}\n\nShall I begin the implementation workflow? (/implement ${nextTask.content.number})`);
      } catch (err) {
        ctx.reply(`❌ Error calculating next task: ${err.message}`);
      }
    });

    this.addCommand('status', 'View full project dashboard and board status.', async (ctx) => {
      const repoToQuery = ctx.message.text.split(' ')[1] || userSession[ctx.from.id]?.selectedRepo;
      if (!repoToQuery) return ctx.reply('❓ Please specify a project name or /select one first.');

      try {
        let reportParts = [];
        const { organization } = await graphqlWithAuth(`
          query getProjects($org: String!) {
            organization(login: $org) {
              projectsV2(first: 3) { nodes { title id } }
            }
          }
        `, { org: GH_ORG });
        
        const project = organization?.projectsV2.nodes[0];
        if (project) {
          const { node } = await graphqlWithAuth(`
            query getProjectItems($id: ID!) {
              node(id: $id) {
                ... on ProjectV2 {
                  title
                  items(first: 50) {
                    nodes {
                      content { ... on Issue { title state number repository { name } } }
                      fieldValues(first: 10) {
                        nodes {
                          ... on ProjectV2ItemFieldSingleSelectValue {
                            name
                            field { ... on ProjectV2SingleSelectField { name } }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          `, { id: project.id });

          let boardSection = `📊 **Project Board: ${node.title}**\n`;
          let count = 0;
          node.items.nodes.forEach(item => {
            if (item.content?.repository?.name?.toLowerCase() === repoToQuery.toLowerCase()) {
              const status = item.fieldValues.nodes.find(v => v.field?.name === 'Status')?.name || 'New';
              const prio = item.fieldValues.nodes.find(v => v.field?.name === 'Priority')?.name || 'None';
              const emoji = status === 'Done' ? '✅' : (prio === 'P0' ? '🚨' : '⏳');
              boardSection += `${emoji} [${prio}][${status}] ${item.content.title} (#${item.content.number})\n`;
              count++;
            }
          });
          if (count > 0) reportParts.push(boardSection);
        }

        const { data: issues } = await octokit.rest.issues.listForRepo({ owner: GH_ORG, repo: repoToQuery, state: 'open' });
        if (issues.length > 0) {
          let repoSection = `📋 **Repo Backlog: ${repoToQuery}**\n`;
          issues.forEach(iss => repoSection += `⏳ [#${iss.number}] ${iss.title}\n`);
          reportParts.push(repoSection);
        }

        if (reportParts.length === 0) return ctx.reply(`📭 No active features found for [${repoToQuery}].`);
        ctx.replyWithMarkdown(reportParts.join('\n---\n'));
      } catch (err) {
        ctx.reply(`❌ Status reporting system error: ${err.message}`);
      }
    });

    this.addCommand('implement', 'Signal implementation for an issue (Status transition).', async (ctx) => {
      const selectedRepo = userSession[ctx.from.id]?.selectedRepo;
      if (!selectedRepo) return ctx.reply('🛑 No project selected.');
      const num = parseInt(ctx.message.text.split(' ')[1]);
      if (!num) return ctx.reply('❓ Please specify an issue number.');

      try {
        await octokit.rest.issues.addLabels({ owner: GH_ORG, repo: selectedRepo, issue_number: num, labels: ['status:implementing'] });
        await octokit.rest.issues.createComment({ 
          owner: GH_ORG, 
          repo: selectedRepo, 
          issue_number: num, 
          body: `🚀 Antigravity Agent: Remote implementation command received.\n\nInitiated by: ${ctx.from.username || ctx.from.id}\nPlatform: Telegram` 
        });
        ctx.reply(`🏗️ Implementation Started for Issue #${num} in [${selectedRepo}].`);
      } catch (err) { ctx.reply(`❌ Error: ${err.message}`); }
    });

    this.addCommand('complete', 'Mark a task as completed and close it in GitHub.', async (ctx) => {
      const selectedRepo = userSession[ctx.from.id]?.selectedRepo;
      if (!selectedRepo) return ctx.reply('🛑 No project selected.');
      const num = parseInt(ctx.message.text.split(' ')[1]);
      if (!num) return ctx.reply('❓ Please specify an issue number.');

      try {
        await octokit.rest.issues.update({ owner: GH_ORG, repo: selectedRepo, issue_number: num, state: 'closed' });
        await octokit.rest.issues.createComment({ 
          owner: GH_ORG, 
          repo: selectedRepo, 
          issue_number: num, 
          body: `🏁 Antigravity Agent: Task completed successfully.\n\nInitiated by: ${ctx.from.username || ctx.from.id}\nPlatform: Telegram` 
        });
        ctx.reply(`✅ Issue #${num} in [${selectedRepo}] HAS BEEN CLOSED.`);
      } catch (err) { ctx.reply(`❌ Error: ${err.message}`); }
    });
  }
}
