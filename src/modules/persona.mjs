import { userSession } from '../session.mjs';
import { getRepoFile } from '../helpers.mjs';
import { BaseModule } from './BaseModule.mjs';

export class PersonaModule extends BaseModule {
  constructor() {
    super('👤 Persona Lenses');
    this.setupCommands();
  }

  setupCommands() {
    this.addCommand('risks', 'Analyze risky assumptions from the discovery document.', async (ctx) => {
      const repo = userSession[ctx.from.id]?.selectedRepo;
      if (!repo) return ctx.reply('🛑 No project selected.');
      const content = await getRepoFile(repo, 'docs/requirements/initial_discovery.md');
      if (!content) return ctx.reply('📭 No discovery doc found.');
      const section = content.match(/## ⚠️ Risky Assumptions\s+([\s\S]*?)($|---|\n#)/);
      const risks = section ? section[1].trim() : '_No risky assumptions identified yet._';
      ctx.replyWithMarkdown(`⚠️ **Risky Assumptions: ${repo}**\n\n${risks}`);
    });

    this.addCommand('roi', 'View Business Value & ROI analysis for the project.', async (ctx) => {
      const repo = userSession[ctx.from.id]?.selectedRepo;
      if (!repo) return ctx.reply('🛑 No project selected.');
      const content = await getRepoFile(repo, 'docs/strategy/business_value.md');
      if (!content) return ctx.reply('📭 No Business Value artifact found.');
      const section = content.match(/## 📊 ROI & Value Analysis\s+([\s\S]*?)($|---|\n#)/);
      const roi = section ? section[1].trim() : '_ROI analysis in progress..._';
      ctx.replyWithMarkdown(`📊 **ROI & Business Value: ${repo}**\n\n${roi}`);
    });

    this.addCommand('solution', 'Examine the physical architecture and solution design.', async (ctx) => {
      const repo = userSession[ctx.from.id]?.selectedRepo;
      if (!repo) return ctx.reply('🛑 No project selected.');

      const content = await getRepoFile(repo, 'docs/architecture/solution_design.md');
      if (!content) {
        return ctx.reply(`📭 No Solution Design found for [${repo}].\n\n💡 Use the IDE Agent to generate "docs/architecture/solution_design.md" based on your requirements!`);
      }

      try {
        const stack = content.match(/## 🛠️ Technical Stack\s+([\s\S]*?)\s+(?:---|\n#)/);
        const arch = content.match(/## 📐 Architecture Pattern\s+([\s\S]*?)\s+(?:---|\n#)/);
        const infra = content.match(/## 📐 Physical Architecture\s+([\s\S]*?)\s+(?:---|\n#)/);

        let report = `🏛️ **Solution Architecture: ${repo}**\n\n`;
        if (stack) report += `🛠️ **Tech Stack**:\n${stack[1].trim()}\n\n`;
        if (arch) report += `📐 **Architecture Pattern**:\n${arch[1].trim()}\n\n`;
        if (infra) report += `🏙️ **Physical Design**:\n${infra[1].trim()}\n\n`;
        ctx.replyWithMarkdown(report);
      } catch (err) {
        ctx.reply('❌ Error parsing solution design.');
      }
    });

    this.addCommand('security', 'Review the security posture and compliance status.', async (ctx) => {
      const repo = userSession[ctx.from.id]?.selectedRepo;
      if (!repo) return ctx.reply('🛑 No project selected.');
      const content = await getRepoFile(repo, 'docs/security/posture.md');
      if (!content) return ctx.reply('📭 No Security Posture found.');
      const section = content.match(/## 🔒 Security, PII & Compliance\s+([\s\S]*?)($|---|\n#)/);
      const security = section ? section[1].trim() : '_Security audit pending..._';
      ctx.replyWithMarkdown(`🔒 **Security Posture: ${repo}**\n\n${security}`);
    });

    this.addCommand('infra', 'Review DevOps requirements and cost estimations.', async (ctx) => {
      const repo = userSession[ctx.from.id]?.selectedRepo;
      if (!repo) return ctx.reply('🛑 No project selected.');
      const content = await getRepoFile(repo, 'docs/infrastructure/cost_estimate.md');
      if (!content) return ctx.reply('📭 No Cost Estimate found.');
      const section = content.match(/## 🏗️ DevOps & Costing\s+([\s\S]*?)($|---|\n#)/);
      const infra = section ? section[1].trim() : '_Cost estimation in progress..._';
      ctx.replyWithMarkdown(`🏗️ **Infrastructure & Costing: ${repo}**\n\n${infra}`);
    });

    this.addCommand('ux', 'Examine UX strategy and design reviews.', async (ctx) => {
      const repo = userSession[ctx.from.id]?.selectedRepo;
      if (!repo) return ctx.reply('🛑 No project selected.');
      const content = await getRepoFile(repo, 'docs/design/ux_review.md');
      if (!content) return ctx.reply('📭 No UX Review found.');
      const section = content.match(/## 🎨 UX Strategy & Reviews\s+([\s\S]*?)($|---|\n#)/);
      const ux = section ? section[1].trim() : '_UX Review pending..._';
      ctx.replyWithMarkdown(`🎨 **UX Strategy: ${repo}**\n\n${ux}`);
    });

    this.addCommand('scenarios', 'View functional test scenarios for a feature.', async (ctx) => {
      const repo = userSession[ctx.from.id]?.selectedRepo;
      const feat = ctx.message.text.split(' ')[1];
      if (!repo || !feat) return ctx.reply('❓ Please specify feature name. Example: /scenarios login');
      const content = await getRepoFile(repo, `docs/architecture/specifications/${feat}.md`);
      if (!content) return ctx.reply(`📭 No specification found for [${feat}].`);
      const scenarios = content.match(/## 🧪 Functional Scenarios\s+([\s\S]*?)\s+(?:---|\n#)/);
      const criteria = content.match(/## 🏁 Success Criteria\s+([\s\S]*?)\s+(?:---|\n#)/);
      let report = `🧪 **Functional Scenarios: ${feat}**\n\n`;
      if (scenarios) report += scenarios[1].trim() + '\n\n';
      if (criteria) report += `🏁 **Success Criteria**:\n${criteria[1].trim()}`;
      ctx.replyWithMarkdown(report);
    });

    this.addCommand('summary', 'Executive project synthesis and value posture.', async (ctx) => {
      const repo = userSession[ctx.from.id]?.selectedRepo;
      if (!repo) return ctx.reply('🛑 No project selected.');
      const discovery = await getRepoFile(repo, 'docs/requirements/initial_discovery.md');
      const business = await getRepoFile(repo, 'docs/strategy/business_value.md');
      const vision = discovery ? (discovery.match(/## 💡 Vision & Core Value\s+([\s\S]*?)\s+---/)?.[1]?.trim() || 'Summary pending...') : 'No discovery doc.';
      const roi = business ? (business.match(/## 📊 ROI & Value Analysis\s+([\s\S]*?)($|---|\n#)/)?.[1]?.trim() || 'ROI pending...') : 'No business strategy doc.';
      let report = `👔 **Executive Summary: ${repo}**\n\n🔭 **Vision**:\n${vision}\n\n💰 **Value Posture**:\n${roi}`;
      ctx.replyWithMarkdown(report);
    });
  }
}
