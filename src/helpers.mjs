import { octokit, GH_ORG } from './config.mjs';

// Helper: Fetch a file from the repository
export async function getRepoFile(repo, path) {
  try {
    const { data: file } = await octokit.rest.repos.getContent({
      owner: GH_ORG,
      repo,
      path
    });
    return Buffer.from(file.content, 'base64').toString();
  } catch (err) {
    console.warn(`⚠️ Could not find [${path}] for ${repo}`);
    return null;
  }
}

export function parseDiscoveryHierarchy(content, level, parentTitle = null) {
  const lines = content.split('\n');
  const sections = [];
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
