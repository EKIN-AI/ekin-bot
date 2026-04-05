import { Telegraf } from 'telegraf';
import { Octokit } from 'octokit';
import { graphql } from '@octokit/graphql';
import 'dotenv/config';

console.log('🚀 Antigravity Bot: Initializing source...');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GH_TOKEN = process.env.GH_TOKEN;
const GH_ORG = process.env.GH_ORG || 'Ekin-AI';
const ALLOWED_ID = process.env.ALLOWED_USER_ID;

console.log(`📡 Environment: ORG=${GH_ORG}, ALLOWED_USER_ID=${ALLOWED_ID || 'NONE'}`);
console.log(`🔑 Tokens: BOT_TOKEN_LEN=${BOT_TOKEN?.length}, GH_TOKEN_LEN=${GH_TOKEN?.length}`);

if (!BOT_TOKEN || !GH_TOKEN) {
  console.error("❌ Missing required environment variables (BOT_TOKEN, GH_TOKEN)");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const octokit = new Octokit({ auth: GH_TOKEN });
const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${GH_TOKEN}`,
  },
});

// Centralized Session Storage (Syncs to GitHub)
let userSession = {};

async function loadSessionFromGitHub() {
  try {
    const { data: file } = await octokit.rest.repos.getContent({
      owner: GH_ORG,
      repo: 'ekin-ai-shell',
      path: 'user_session.json'
    });
    const content = Buffer.from(file.content, 'base64').toString();
    userSession = JSON.parse(content);
    console.log('🔄 Global Session Loaded from GitHub');
  } catch (err) {
    console.warn('⚠️ Could not load user_session.json from GitHub. Initializing empty.');
    userSession = {};
  }
}

async function syncSessionToGitHub(userId, selectedRepo) {
  try {
    // 1. Get the current file (to get the SHA)
    let sha;
    try {
      const { data: file } = await octokit.rest.repos.getContent({
        owner: GH_ORG,
        repo: 'ekin-ai-shell',
        path: 'user_session.json'
      });
      sha = file.sha;
    } catch (e) { /* File might not exist yet */ }

    // 2. Prepare new content
    userSession[userId] = {
      selectedRepo,
      lastSync: new Date().toISOString(),
      platform: 'Telegram'
    };

    await octokit.rest.repos.createOrUpdateFileContents({
      owner: GH_ORG,
      repo: 'ekin-ai-shell',
      path: 'user_session.json',
      message: `🔄 Sync Session: ${selectedRepo} for User ${userId}`,
      content: Buffer.from(JSON.stringify(userSession, null, 2)).toString('base64'),
      sha
    });
    console.log(`✅ Session Synced to GitHub for ${selectedRepo}`);
  } catch (err) {
    console.error('❌ Failed to sync session to GitHub:', err.message);
  }
}

// Global Middleware: Lockdown to User ID + Logs
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;
  const username = ctx.from?.username || 'unknown';
  const text = ctx.message?.text || '[non-text message]';

  console.log(`📩 [MIDDLEWARE] IN: from=${username} (${userId}), text="${text}"`);

  if (!ALLOWED_ID) {
    console.warn("⚠️ ALLOWED_USER_ID is not set. Bot is open to anyone!");
  } else if (String(userId) !== String(ALLOWED_ID)) {
    console.warn(`🛑 [MIDDLEWARE] BLOCKED: ID mismatch. Expected ${ALLOWED_ID}, got ${userId}`);
    return; // Silent block for unauthorized users
  }
  
  console.log(`✅ [MIDDLEWARE] PASS: ${text}`);
  return next();
});

// Alias: /list -> /projects, /roadmap -> /requirements
bot.command('list', (ctx) => {
  console.log('🔄 ALIAS: /list -> /projects');
  return ctx.reply('🔄 Use /projects to see your repo list. Redirecting...');
});

bot.command('roadmap', (ctx) => {
  console.log('🔄 ALIAS: /roadmap -> /requirements');
  return ctx.executeCommand('requirements'); 
});

bot.start((ctx) => ctx.reply('🚀 Ekin Bot Orchestrator Online. Use /projects to begin.'));

// Command: /projects - List all repos in the org
bot.command('projects', async (ctx) => {
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

// Command: /select <NAME>
bot.command('select', async (ctx) => {
  console.log('📂 [COMMAND] /select');
  const repoName = ctx.message.text.split(' ')[1];
  if (!repoName) return ctx.reply('❓ Please specify a repository name. Example: /select app1');

  // Persist to GitHub!
  await syncSessionToGitHub(ctx.from.id, repoName);
  ctx.reply(`🎯 Selected project: ${repoName}.\n\nThis selection is now synchronized with your IDE Cockpit! (Synced to GitHub)`);
});

// Command: /feature <TITLE>
bot.command('feature', async (ctx) => {
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

// Command: /next - Find the highest priority task
bot.command('next', async (ctx) => {
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
                    ... on Issue { title number }
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
    if (!project) return ctx.reply('📭 No GitHub Projects found.');

    const items = project.items.nodes.filter(i => i.content?.title);

    // Sort logic: P0 > P1 > P2 > Others
    const priorityMap = { 'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3, 'New': 4 };

    const sortedItems = items.sort((a, b) => {
      const aPrioStr = a.fieldValues.nodes.find(f => f.field?.name === 'Priority')?.name || 'New';
      const bPrioStr = b.fieldValues.nodes.find(f => f.field?.name === 'Priority')?.name || 'New';
      return (priorityMap[aPrioStr] ?? 99) - (priorityMap[bPrioStr] ?? 99);
    });

    const nextTask = sortedItems[0];
    if (!nextTask) return ctx.reply('✅ No tasks found in the queue!');

    const prio = nextTask.fieldValues.nodes.find(f => f.field?.name === 'Priority')?.name || 'None';
    ctx.reply(`🎯 HIGH PRIORITY NEXT TASK:\n\n[${prio}] ${nextTask.content.title}\nIssue #${nextTask.content.number}\n\nShall I begin the implementation workflow? (/implement ${nextTask.content.number})`);
  } catch (err) {
    ctx.reply(`❌ Error calculating next task: ${err.message}`);
  }
});

// Command: /status - Get GitHub Project V2 status (Enhanced)
bot.command('status', async (ctx) => {
  const userId = String(ctx.from.id);
  console.log(`📊 STATUS REQUEST: user=${userId}`);
  
  const session = userSession[userId] || userSession[ctx.from.id];
  const selectedRepo = session?.selectedRepo;
  const repoToQuery = ctx.message.text.split(' ')[1] || session?.selectedRepo;

  console.log(`🔍 STATUS CONTEXT: repoToQuery=${repoToQuery}, userId=${userId}`);

  if (!repoToQuery) {
    console.log('⚠️ No repository target found');
    return ctx.reply('❓ Please specify a project name or /select one first.');
  }

  try {
    let reportParts = [];
    console.log(`🌐 [STATUS] Beginning Total Visibility sync for ${repoToQuery}...`);

    // A. Project Board Sync
    try {
      const { organization } = await graphqlWithAuth(`
        query getProjects($org: String!) {
          organization(login: $org) {
            projectsV2(first: 3) {
              nodes { title id }
            }
          }
        }
      `, { org: GH_ORG });
      const project = organization?.projectsV2?.nodes?.[0];
      
      if (project) {
        const { node } = await graphqlWithAuth(`
          query getProjectItems($id: ID!) {
            node(id: $id) {
              ... on ProjectV2 {
                title
                items(first: 50) {
                  nodes {
                    content {
                      ... on Issue { title state number repository { name } }
                    }
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
        let boardCount = 0;
        node.items.nodes.forEach(item => {
          if (item.content?.repository?.name?.toLowerCase() === repoToQuery.toLowerCase()) {
            const statusValue = item.fieldValues.nodes.find(v => v.field?.name === 'Status')?.name || 'New';
            const prioValue = item.fieldValues.nodes.find(v => v.field?.name === 'Priority')?.name || 'None';
            const emoji = statusValue === 'Done' ? '✅' : (prioValue === 'P0' ? '🚨' : '⏳');
            boardSection += `${emoji} [${prioValue}][${statusValue}] ${item.content.title} (#${item.content.number})\n`;
            boardCount++;
          }
        });
        if (boardCount > 0) reportParts.push(boardSection);
      }
    } catch (err) {
      console.warn('⚠️ Board sync failed (SSO/Scope):', err.message);
    }

    // B. Repository Issues (Backlog) Sync
    try {
      const { data: issues } = await octokit.rest.issues.listForRepo({
        owner: GH_ORG,
        repo: repoToQuery,
        state: 'open',
        per_page: 15
      });
      
      if (issues.length > 0) {
        let repoSection = `📋 **Repo Backlog: ${repoToQuery}**\n`;
        issues.forEach(issue => {
          const labels = issue.labels.map(l => l.name).join(', ') || 'no status';
          repoSection += `⏳ [#${issue.number}] ${issue.title} (_${labels}_)\n`;
        });
        reportParts.push(repoSection);
      }
    } catch (err) {
      console.warn('⚠️ Repo backlog sync failed:', err.message);
    }

    // Final Delivery
    if (reportParts.length === 0) {
      return ctx.reply(`📭 No active features or issues found for **[${repoToQuery}]**. Try adding one using /feature!`);
    }

    let finalReport = reportParts.join('\n---\n');
    finalReport += `\n🔄 **Hardened Sync: ACTIVE**\n⏰ Last Global Sync: ${session?.lastSync || 'Never'}`;
    
    console.log('✅ [STATUS] Report finalized. Sending to Telegram...');
    await ctx.replyWithMarkdown(finalReport);
    console.log('🏁 [STATUS] Delivery confirmed.');

  } catch (err) {
    console.error('❌ [STATUS] CRITICAL FAILURE:', err);
    ctx.reply(`❌ Status reporting system error: ${err.message}. Please verify repository [${repoToQuery}] exists.`);
  }
});

// Command: /kickoff <NAME>
bot.command('kickoff', async (ctx) => {
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

    const { data: issue } = await octokit.rest.issues.create({
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

// Command: /bootstrap - Request tech setup (Vault, Postgres, etc.)
bot.command('bootstrap', async (ctx) => {
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

// Command: /implement <ISSUE_NUMBER>
bot.command('implement', async (ctx) => {
  const session = userSession[ctx.from.id];
  const selectedRepo = session?.selectedRepo;
  if (!selectedRepo) return ctx.reply('🛑 No project selected. Use /select <name> first.');

  const issueNumber = parseInt(ctx.message.text.split(' ')[1]);
  if (!issueNumber || isNaN(issueNumber)) return ctx.reply('❓ Please specify an issue number. Example: /implement 1');

  try {
    await octokit.rest.issues.addLabels({
      owner: GH_ORG,
      repo: selectedRepo,
      issue_number: issueNumber,
      labels: ['status:implementing']
    });

    await octokit.rest.issues.createComment({
      owner: GH_ORG,
      repo: selectedRepo,
      issue_number: issueNumber,
      body: '🚀 Antigravity Agent: Remote implementation command received. Starting work...'
    });

    ctx.reply(`🏗️ Implementation Started for Issue #${issueNumber} in [${selectedRepo}].\n\nI will notify you on the next status check!`);
  } catch (err) {
    ctx.reply(`❌ Error triggering implementation: ${err.message}`);
  }
});

// Helper: Parse the hierarchical discovery Markdown
async function getDiscoveryContent(repo) {
  try {
    const { data: file } = await octokit.rest.repos.getContent({
      owner: GH_ORG,
      repo,
      path: 'docs/requirements/initial_discovery.md'
    });
    return Buffer.from(file.content, 'base64').toString();
  } catch (err) {
    console.warn(`⚠️ Could not find discovery doc for ${repo}`);
    return null;
  }
}

function parseDiscoveryHierarchy(content, level, parentTitle = null) {
  const lines = content.split('\n');
  const sections = [];
  let currentSection = null;
  let capturing = !parentTitle;

  const headerPrefix = '#'.repeat(level) + ' ';

  for (const line of lines) {
    if (line.startsWith(headerPrefix)) {
      const title = line.replace(headerPrefix, '').trim();
      
      if (parentTitle) {
        // If we are looking for children of a specific parent
        if (capturing && line.startsWith('#'.repeat(level-1) + ' ')) break; // Hit next parent
        if (title.toLowerCase().includes(parentTitle.toLowerCase())) {
          capturing = true;
          continue;
        }
      }

      if (capturing) {
        sections.push(title);
      }
    }
  }
  return sections;
}

// Command: /requirements - High-level vision
bot.command('requirements', async (ctx) => {
  const userId = String(ctx.from.id);
  const session = userSession[userId] || userSession[ctx.from.id];
  const repo = session?.selectedRepo;
  console.log(`📋 [COMMAND] /requirements (repo=${repo})`);

  if (!repo) return ctx.reply('🛑 No project selected. Use /select <name> first.');

  const content = await getDiscoveryContent(repo);
  if (!content) return ctx.reply(`📭 No discovery heart found for [${repo}]. Please /kickoff first.`);

  try {
    // 1. Refined Vision Extraction
    const visionMatch = content.match(/## 💡 Vision & Core Value\s+([\s\S]*?)\s+---/);
    const vision = visionMatch ? visionMatch[1].trim() : 'Project vision in synthesis...';
    
    // 2. Refined Phase Parsing (Look for the Phase Roadmap list)
    let phases = [];
    const roadmapSection = content.match(/## 🚀 Phase Roadmap\s+([\s\S]*?)($|\n#)/);
    if (roadmapSection) {
      phases = roadmapSection[1].trim().split('\n').filter(l => l.trim().startsWith('1.') || l.trim().startsWith('-') || l.trim().match(/^\d\./));
    }

    let report = `🔭 **Project Vision: ${repo}**\n\n${vision}\n\n`;
    report += `🚀 **Current Lifecycle**:\n${phases.join('\n') || '_Phases in architecture..._'}\n\nUse /epics to see the roadmap structure.`;
    
    console.log(`✅ [COMMAND] /requirements finalized for ${repo}`);
    ctx.replyWithMarkdown(report);
  } catch (err) {
    console.error('❌ [COMMAND] /requirements parsing failed:', err);
    ctx.reply('❌ Error parsing project roadmap. Please ensure initial_discovery.md is structured correctly.');
  }
});

// Command: /epics - List all Epics
bot.command('epics', async (ctx) => {
  const repo = userSession[ctx.from.id]?.selectedRepo;
  if (!repo) return ctx.reply('🛑 No project selected.');

  const content = await getDiscoveryContent(repo);
  if (!content) return ctx.reply('📭 No roadmap found.');

  const epics = parseDiscoveryHierarchy(content, 1);
  let report = `🏛️ **Project Epics: ${repo}**\n\n`;
  epics.forEach((epic, i) => {
    report += `${i + 1}. ${epic}\n`;
  });
  report += `\nUse /features <name> to drill down.`;
  ctx.replyWithMarkdown(report);
});

// Command: /features <EPIC>
bot.command('features', async (ctx) => {
  const repo = userSession[ctx.from.id]?.selectedRepo;
  const epicQuery = ctx.message.text.replace('/features ', '').trim();
  if (!repo || !epicQuery || epicQuery === '/features') return ctx.reply('❓ Please specify an Epic name or /epics first.');

  const content = await getDiscoveryContent(repo);
  const features = parseDiscoveryHierarchy(content, 2, epicQuery);

  if (features.length === 0) return ctx.reply(`📭 No features found for Epic: "${epicQuery}"`);

  let report = `🧩 **Features for Epic: ${epicQuery}**\n\n`;
  features.forEach((feat, i) => report += `${i + 1}. ${feat}\n`);
  report += `\nUse /stories <name> for the user impact.`;
  ctx.replyWithMarkdown(report);
});

// Command: /stories <FEATURE>
bot.command('stories', async (ctx) => {
  const repo = userSession[ctx.from.id]?.selectedRepo;
  const featQuery = ctx.message.text.replace('/stories ', '').trim();
  if (!repo || !featQuery || featQuery === '/stories') return ctx.reply('❓ Please specify a Feature name.');

  const content = await getDiscoveryContent(repo);
  const stories = parseDiscoveryHierarchy(content, 3, featQuery);

  if (stories.length === 0) return ctx.reply(`📭 No user stories found for: "${featQuery}"`);

  let report = `📖 **User Stories: ${featQuery}**\n\n`;
  stories.forEach((story, i) => report += `• ${story}\n`);
  ctx.replyWithMarkdown(report);
});

// Command: /task <NUMBER> - Detailed Task Lookup
bot.command('task', async (ctx) => {
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

console.log('🤖 Antigravity Bot: Launching Long Polling...');

// Initializing bot...
(async () => {
  try {
    await loadSessionFromGitHub();
    await bot.launch();
    console.log('✅ Ekin Bot Orchestrator is running (Total Visibility Hierarchy)');
  } catch (err) {
    console.error('❌ Antigravity Bot: Launch Error:', err);
    process.exit(1);
  }
})();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
