import { octokit, GH_ORG, graphqlWithAuth } from '../config.mjs';
import { userSession } from '../session.mjs';
import { getRepoFile, parseDiscoveryHierarchy } from '../helpers.mjs';
import { BaseModule } from './BaseModule.mjs';

const PROJECT_ID = 'PVT_kwDODigM5s4BFUkB'; // Roadmap Project

export class SyncModule extends BaseModule {
  constructor() {
    super('🔄 Synchronization');
    this.setupCommands();
  }

  setupCommands() {
    this.addCommand('sync', 'Synchronize discovery documentation with GitHub Issues (Epics/Features/Stories).', async (ctx) => {
      const repo = userSession[ctx.from.id]?.selectedRepo;
      if (!repo) return ctx.reply('🛑 No project selected. Use /select <name> first.');

      ctx.reply(`🔄 Starting advanced synchronization for [${repo}]...`);

      try {
        const content = await getRepoFile(repo, 'docs/requirements/initial_discovery.md');
        if (!content) return ctx.reply('📭 No discovery doc found to sync.');

        // 1. Fetch existing issues (labeled epic, feature, story)
        const { data: existingIssues } = await octokit.rest.issues.listForRepo({
          owner: GH_ORG,
          repo,
          labels: 'epic,feature,story',
          state: 'all',
          per_page: 100
        });

        // 2. Parse Hierarchy from Document
        const docEpics = parseDiscoveryHierarchy(content, 1);
        const docAllTitles = new Set();
        docEpics.forEach(e => {
          docAllTitles.add(`[EPIC] ${e}`.toLowerCase());
          parseDiscoveryHierarchy(content, 2, e).forEach(f => {
            docAllTitles.add(`[FEAT] ${f}`.toLowerCase());
            parseDiscoveryHierarchy(content, 3, f).forEach(s => {
              docAllTitles.add(`[STORY] ${s}`.toLowerCase());
            });
          });
        });

        const results = { created: 0, closed: 0, skipped: 0, errors: 0, projectAdded: 0 };

        // Helper: Add to Project Board
        const addToProject = async (contentId) => {
          try {
            await graphqlWithAuth(`
              mutation (\$projectId: ID!, \$contentId: ID!) {
                addProjectV2ItemById(input: {projectId: \$projectId, contentId: \$contentId}) {
                  item { id }
                }
              }
            `, { projectId: PROJECT_ID, contentId });
            results.projectAdded++;
          } catch (e) {
            console.error('❌ Project V2 Error:', e.message);
          }
        };

        // Helper: Upsert Issue
        const upsertIssue = async (title, label, body) => {
          const existing = existingIssues.find(i => i.title.toLowerCase() === title.toLowerCase());
          
          if (existing) {
            if (existing.state === 'closed') {
              await octokit.rest.issues.update({ owner: GH_ORG, repo, issue_number: existing.number, state: 'open' });
            }
            await addToProject(existing.node_id);
            results.skipped++;
            return;
          }

          try {
            const { data: issue } = await octokit.rest.issues.create({
              owner: GH_ORG,
              repo,
              title,
              labels: [label],
              body: `${body}\n\n---\n**Audit Log**:\n- Initiator: ${ctx.from.username || ctx.from.id}\n- Platform: Telegram (via /sync)\n- Timestamp: ${new Date().toISOString()}`
            });
            await addToProject(issue.node_id);
            results.created++;
          } catch (e) {
            console.error(`❌ Sync error for [${title}]:`, e.message);
            results.errors++;
          }
        };

        // 3. Close Orphaned Issues (In labels but NOT in doc)
        for (const issue of existingIssues) {
          if (issue.state === 'open' && !docAllTitles.has(issue.title.toLowerCase())) {
            await octokit.rest.issues.update({ owner: GH_ORG, repo, issue_number: issue.number, state: 'closed' });
            await octokit.rest.issues.createComment({
              owner: GH_ORG,
              repo,
              issue_number: issue.number,
              body: '🏁 Ekin Bot: Closed because this item was removed from the strategic discovery document.'
            });
            results.closed++;
          }
        }

        // 4. Process Hierarchy
        for (const epic of docEpics) {
          await upsertIssue(`[EPIC] ${epic}`, 'epic', `Strategic project pillar imported from documentation.`);
          const features = parseDiscoveryHierarchy(content, 2, epic);
          for (const feat of features) {
            await upsertIssue(`[FEAT] ${feat}`, 'feature', `Feature detail for Epic: ${epic}`);
            const stories = parseDiscoveryHierarchy(content, 3, feat);
            for (const story of stories) {
              await upsertIssue(`[STORY] ${story}`, 'story', `User story for Feature: ${feat}`);
            }
          }
        }

        ctx.reply(`✅ Advanced Sync Complete for [${repo}]:\n\n✨ Created: ${results.created}\n🏁 Closed (Orphaned): ${results.closed}\n📊 Added to Project: ${results.projectAdded}\n⏩ Existing/Skipped: ${results.skipped}\n❌ Errors: ${results.errors}\n\nYour backlog is now perfectly mirrored on GitHub!`);
      } catch (err) {
        ctx.reply(`❌ Sync failed: ${err.message}`);
      }
    });
  }
}
