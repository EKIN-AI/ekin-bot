import { octokit, GH_ORG, ALLOWED_ID } from './config.mjs';

/**
 * Access Control Module
 * Manages repository-level permissions for Telegram Users.
 */
export class AccessControl {
  constructor() {
    this.permissions = {};
    this.lastLoaded = null;
  }

  async loadPermissions() {
    try {
      const { data: file } = await octokit.rest.repos.getContent({
        owner: GH_ORG,
        repo: 'ekin-ai-shell',
        path: 'permissions.json'
      });
      const content = Buffer.from(file.content, 'base64').toString();
      this.permissions = JSON.parse(content);
      this.lastLoaded = new Date();
      console.log('🛡️ Permissions ACL Loaded from GitHub');
    } catch (err) {
      console.warn('⚠️ Could not load permissions.json. Falling back to hardcoded ALLOWED_ID.');
      this.permissions = {
        global_admins: [ALLOWED_ID],
        repo_access: {}
      };
    }
  }

  /**
   * Check if a user is authorized for a specific action or repository.
   * @param {string|number} userId 
   * @param {string} repoName (Optional)
   */
  isAuthorized(userId, repoName = null) {
    const id = String(userId);
    
    // 1. Global Admin Check (Super-User)
    if (this.permissions.global_admins?.includes(id) || id === String(ALLOWED_ID)) {
      return true;
    }

    // 2. Repository-specific Check
    if (repoName && this.permissions.repo_access?.[repoName]) {
      return this.permissions.repo_access[repoName].includes(id);
    }

    return false;
  }
}

export const access = new AccessControl();
