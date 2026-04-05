import { Octokit } from 'octokit';
import { graphql } from '@octokit/graphql';
import 'dotenv/config';

export const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
export const GH_TOKEN = process.env.GH_TOKEN;
export const GH_ORG = process.env.GH_ORG || 'Ekin-AI';
export const ALLOWED_ID = process.env.ALLOWED_USER_ID;

if (!BOT_TOKEN || !GH_TOKEN) {
  console.error("❌ Missing required environment variables (BOT_TOKEN, GH_TOKEN)");
  process.exit(1);
}

export const octokit = new Octokit({ auth: GH_TOKEN });
export const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${GH_TOKEN}`,
  },
});
