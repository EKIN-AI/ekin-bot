# 🤖 Ekin Bot Orchestrator

The **Ekin Bot** is a high-performance, autonomous project orchestrator designed to bridge the gap between human vision (Telegram) and technical reality (GitHub). It provides a hardened, hierarchical interface for navigating project requirements, epics, and real-time status.

---

## 🏛️ Hierarchical Discovery Engine
Ekin Bot moves beyond simple task-tracking by offering a deep-dive into your project's architecture directly from your phone.

### Core Navigation Commands
- **🔭 `/requirements`**: High-level vision and current project lifecycle status.
- **🏛️ `/epics`**: Visualize the major business pillars.
- **🧩 `/features <EPIC>`**: Drill down into specific technical capabilities.
- **📖 `/stories <FEAT>`**: View human-centric user stories for any feature.
- **🎫 `/task <#ID>`**: Real-time status lookup of any live GitHub Issue.

---

## 📡 Total Visibility Sync
The bot features a custom "Dual-Sync" reporting engine that guarantees 100% visibility regardless of GitHub organizational restrictions:
- **Roadmap Sync**: Queries GitHub Project V2 boards via GraphQL.
- **Backlog Sync**: Queries repository issues via REST as a fallback.
- **Persistent Sessions**: Project context is maintained across restarts via GitHub-backed persistence.

---

## 🔒 Security & Performance
- **ID-Lockdown**: Strictly authorized for Telegram ID `8375421791`. 
- **Hardened Middleware**: All commands pass through a security layer that verifies permissions and GitHub token health before execution.
- **Network Optimized**: Built-in MTU 1400 fix for high-reliability communication within KinD (Kubernetes) clusters.

---

## 🚀 Deployment (KinD)
The bot is containerized and deployed to a local **KinD (Kubernetes in Docker)** environment:

1. **Build**: `docker build -t ekin-bot:latest .`
2. **Load**: `kind load docker-image ekin-bot:latest --name antigravity`
3. **Deploy**: `kubectl apply -f deployment.yaml`

---

## 🛠️ Tech Stack
- **Runtime**: Node.js (v20-slim)
- **Framework**: Telegraf
- **Intelligence**: Octokit (REST + GraphQL)
- **Orchestration**: Kubernetes (KinD)
