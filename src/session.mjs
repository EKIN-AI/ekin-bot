import { octokit, GH_ORG } from './config.mjs';

// Centralized Session Storage (Syncs to GitHub)
export let userSession = {};

export async function loadSessionFromGitHub() {
  try {
    const { data: file } = await octokit.rest.repos.getContent({
      owner: GH_ORG,
      repo: 'ekin-ai-shell',
      path: 'user_session.json'
    });
    const content = Buffer.from(file.content, 'base64').toString();
    userSession = JSON.parse(content);
    console.log('🔄 Global Session Loaded from GitHub');
    return userSession;
  } catch (err) {
    console.warn('⚠️ Could not load user_session.json from GitHub. Initializing empty.');
    userSession = {};
    return userSession;
  }
}

export async function syncSessionToGitHub(userId, selectedRepo) {
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
