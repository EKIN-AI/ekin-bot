# 🤖 Ekin Bot Orchestrator

**Audience**: Internal Developers & Project Stakeholders
**Objective**: Autonomous orchestration of Ekin-AI projects via Telegram-to-GitHub bridge.

The **Ekin Bot** is a high-performance, autonomous project orchestrator designed to bridge the gap between human vision (Telegram) and technical reality (GitHub). It provides a hardened, hierarchical interface for navigating project requirements, epics, and real-time status.

## 🔄 Orchestration Flow (The Dispatch Pattern)

```mermaid
graph TD
    User(("User (Telegram)")) -- "/kickoff, /implement" --> Bot["Ekin Bot (Telegraf)"]
    
    subgraph "Cloud Infrastructure (KinD)"
        Bot
    end
    
    Bot -- "1. Detailed Issue Payload" --> TargetRepo["Target Project Repo"]
    Bot -- "2. Lightweight Notification Pointer" --> Inbox["Global Inbox: ekin-ai-shell"]
    
    Inbox <-- "3. Polls for [DISPATCH]" --> Poller["Local Daemon (poller.mjs)"]
    
    Poller -- "4. Git Pull/Clone" --> LocalFS["Local File System (~/projects)"]
    Poller -- "5. Hand off to CLI" --> AIAgent["Antigravity AI Agent"]
    
    AIAgent -- "6. Reads task details" --> TargetRepo
    AIAgent -- "7. Scaffolds / Types Code" --> LocalFS
```

**The Architecture:**
1. **Target Routing**: All heavy details (JSON logic, audit trails, and instructions) are securely written directly into the target project where they belong.
2. **Dispatch Notifications**: A tiny pointer ticket is dropped into the central `ekin-ai-shell` repository.
3. **Local Poller**: A background process (`poller.mjs`) on your dev machine acts as a router. It reads the dispatch, performs Git operations without destroying local uncommitted work, and invokes the headless AI agent to work on the code locally.

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
