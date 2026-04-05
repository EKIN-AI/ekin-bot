import { octokit, GH_ORG } from '../config.mjs';
import { userSession } from '../session.mjs';
import { getRepoFile, parseDiscoveryHierarchy } from '../helpers.mjs';
import { BaseModule } from './BaseModule.mjs';

export class SyncModule extends BaseModule {
  constructor() {
    super('🔄 Synchronization');
    this.setupCommands();
  }

  setupCommands() {
    this.addCommand('sync', 'Synchronize discovery documentation with GitHub Issues (Epics/Features/Stories).', async (ctx) => {
      const repo = userSession[ctx.from.id]?.selectedRepo;
      if (!repo) return ctx.reply('🛑 No project selected. Use /select <name> first.');

      ctx.reply(`🔄 Starting synchronization for [${repo}]...`);

      try {
        const content = await getRepoFile(repo, 'docs/requirements/initial_discovery.md');
        if (!content) return ctx.reply('📭 No discovery doc found to sync.');

        // 1. Fetch existing issues to avoid duplicates
        const { data: existingIssues } = await octokit.rest.issues.listForRepo({
          owner: GH_ORG,
          repo,
          state: 'all',
          per_page: 100
        });
        const existingTitles = new Set(existingIssues.map(i => i.title.toLowerCase()));

        // 2. Parse Hierarchy
        const epics = parseDiscoveryHierarchy(content, 1);
        const results = { created: 0, skipped: 0, errors: 0 };

        // Helper to create issue if missing
        const upsertIssue = async (title, label, body) => {
          if (existingTitles.has(title.toLowerCase())) {
            results.skipped++;
            return;
          }

          try {
            await octokit.rest.issues.create({
              owner: GH_ORG,
              repo,
              title,
              labels: [label],
              body: `${body}\n\n---\n**Audit Log**:\n- Initiator: ${ctx.from.username || ctx.from.id}\n- Platform: Telegram (via /sync)\n- Timestamp: ${new Date().toISOString()}`
            });
            results.created++;
          } catch (e) {
            console.error(`❌ Sync error for [${title}]:`, e.message);
            results.errors++;
          }
        };

        // 3. Process Epics
        for (const epic of epics) {
          await upsertIssue(`[EPIC] ${epic}`, 'epic', `Strategic project pillar imported from documentation.`);
          
          // 4. Process Features for this Epic
          const features = parseDiscoveryHierarchy(content, 2, epic);
          for (const feat of features) {
            await upsertIssue(`[FEAT] ${feat}`, 'feature', `Feature detail for Epic: ${epic}`);
            
            // 5. Process Stories for this Feature
            const stories = parseDiscoveryHierarchy(content, 3, feat);
            for (const story of stories) {
              await upsertIssue(`[STORY] ${story}`, 'story', `User story for Feature: ${feat}`);
            }
          }
        }

        ctx.reply(`✅ Sync Complete for [${repo}]:\n\n✨ Created: ${results.created}\n⏩ Skipped: ${results.skipped}\n❌ Errors: ${results.errors}\n\nYour backlog is now live on GitHub!`);
      } catch (err) {
        ctx.reply(`❌ Sync failed: ${err.message}`);
      }
    });
  }
}
