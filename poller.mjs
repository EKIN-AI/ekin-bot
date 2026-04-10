import { Octokit } from 'octokit';
import 'dotenv/config';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Config from .env
const GH_TOKEN = process.env.GH_TOKEN;
const GH_ORG = process.env.GH_ORG || 'Ekin-AI';

// Because this script runs in ~/projects/ekin-bot, we resolve the parent directory 
// to get to the root ~/projects folder!
const PROJECTS_DIR = path.resolve(__dirname, '..'); 

if (!GH_TOKEN) {
  console.error("❌ Missing required environment variable GH_TOKEN in .env");
  process.exit(1);
}

const octokit = new Octokit({ auth: GH_TOKEN });

// Utility to run shell commands synchronously and log output
function runCmd(cmd, cwd) {
  console.log(`\n[$ ${cmd}] (in ${cwd})`);
  try {
    const output = execSync(cmd, { cwd, encoding: 'utf-8', stdio: 'pipe' });
    console.log(output);
    return true;
  } catch (err) {
    console.error(`❌ Execution failed: ${err.message}`);
    // If pull fails due to uncommitted changes, it will log and gracefully continue
    return false;
  }
}

async function startPolling() {
  console.log(`👀 Starting local Antigravity poller.`);
  console.log(`📁 Host project directory mapped to: ${PROJECTS_DIR}`);
  console.log(`📡 Listening for dispatches in ${GH_ORG}/ekin-ai-shell...`);
  
  // Poll every 30 seconds
  setInterval(async () => {
    try {
      // 1. Fetch dispatch issues
      const { data: issues } = await octokit.rest.issues.listForRepo({
        owner: GH_ORG,
        repo: 'ekin-ai-shell',
        labels: 'status:dispatch-pending',
        state: 'open'
      });

      if (issues.length === 0) return;

      for (const issue of issues) {
        console.log(`\n======================================================`);
        console.log(`📬 [DISPATCH RECEIVED]: ${issue.title}`);
        console.log(`======================================================`);

        // 2. Acknowledge and transition status immediately
        await octokit.rest.issues.update({
          owner: GH_ORG,
          repo: 'ekin-ai-shell',
          issue_number: issue.number,
          labels: ['status:in-progress'] // change from dispatch-pending
        });

        // 3. Extract the target project
        // E.g. "[DISPATCH] New task in ekin-portal" -> extracts "ekin-portal"
        const titleWords = issue.title.split(' ');
        const projectName = titleWords[titleWords.length - 1]; 
        
        console.log(`🎯 Target Project Detected: [${projectName}]`);
        
        // 4. GitSync locally (in parent ~/projects dir)
        const projectPath = path.join(PROJECTS_DIR, projectName);
        
        if (!fs.existsSync(projectPath)) {
          console.log(`📁 Project folder not found locally. Cloning...`);
          runCmd(`git clone git@github.com:${GH_ORG}/${projectName}.git`, PROJECTS_DIR);
          
          console.log(`🔗 Linking AI brain (.clinerules, skills, workflows) from ekin-ai-shell to ${projectName}...`);
          const shellPath = path.join(PROJECTS_DIR, 'ekin-ai-shell');
          runCmd(`ln -sf ${path.join(shellPath, '.clinerules')} .clinerules`, projectPath);
          runCmd(`ln -sf ${path.join(shellPath, 'skills')} skills`, projectPath);
          runCmd(`ln -sf ${path.join(shellPath, 'workflows')} workflows`, projectPath);
        } else {
          console.log(`📁 Project folder found. Pulling latest code...`);
          // Note: pulling explicitly without rebase/stash to respect local state
          // This will safely abort if there are conflict errors, protecting user work.
          runCmd(`git pull origin main --rebase=false`, projectPath);
        }

        // 5. Hand over to AI Agent
        console.log(`🚀 Handing off to local AI Agent...`);
        
        // Extract the target repository issue URL from the body
        const issueUrlMatch = issue.body.match(/https:\/\/github\.com\/[^\/]+\/[^\/]+\/issues\/\d+/);
        const targetUrl = issueUrlMatch ? issueUrlMatch[0] : 'URL Not Found';
        
        console.log(`\n[AGENT WAKEUP ALERT]`);
        console.log(`URL to execute on: ${targetUrl}`);
        console.log(`Please execute your IDE CLI hook (like 'cline') to process this issue!`);
        
        console.log(`✅ Dispatch processed.`);
      }

    } catch (err) {
      console.error(`❌ Polling error: ${err.message}`);
    }
  }, 30000); // 30 seconds
}

startPolling();
