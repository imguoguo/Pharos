<div align="center">
  <img src="assets/banner.png" alt="Pharos" width="100%" />
  <br/><br/>
  <p><strong>Intelligent Codebase Assistant for Discord</strong></p>
  <p>
    <a href="#features">Features</a> •
    <a href="#quick-start">Quick Start</a> •
    <a href="#deployment">Deployment</a> •
    <a href="#configuration">Configuration</a> •
    <a href="#bot-commands">Bot Commands</a> •
    <a href="#architecture">Architecture</a>
  </p>
  <br/>
</div>

<details>
<summary><b>🇨🇳 中文文档</b></summary>

## 简介

Pharos 是一个智能代码库助手 Discord 机器人。当用户在频道中 @mention 它时，它会自动探索关联项目的代码、文档和知识源，为用户提供准确的技术解答。

## 核心功能

- **Discord Bot** — @mention 触发，自动探索代码库并回答问题
- **多 LLM 支持** — Anthropic API / OpenAI Chat Completions / OpenAI Responses API，支持优先级轮询和故障转移
- **项目制管理** — 项目下管理多个信息源，Discord 频道绑定到项目
- **Git 仓库追踪** — 通过 URL 添加仓库，自动 clone/pull，定时同步，自动生成索引
- **智能索引** — Agent 自动理解代码库结构并生成索引文档，后续查询直接参考索引减少探索轮次
- **Web 管理面板** — Vue 3 前端，深浅主题，中英文 i18n，项目/LLM/频道/历史全面管理
- **实时进度** — Discord 中实时显示 Agent 探索进度，面板中查看完整探索步骤
- **安全加固** — 暴力破解防护、API 限流、安全响应头、Token 持久化

## 快速开始

```bash
git clone https://github.com/BeaconCat/Pharos.git
cd Pharos
pnpm install
pnpm build
```

部署包生成在 `deploy/` 目录，可直接移走部署：

```bash
cd deploy
./start.sh    # Linux/Mac
start.bat     # Windows
```

首次启动自动安装依赖并创建配置文件，默认密码 `pharos`，端口 `2468`。

## Bot 指令

| 指令 | 说明 |
|------|------|
| `help` | 普通用户看自我介绍，管理员看指令列表 |
| `project create <name>` | 创建项目 |
| `project list` | 列出所有项目 |
| `project bind <project>` | 绑定当前频道到项目 |
| `project unbind <project>` | 解绑 |
| `repo add <project> <url> [branch] [interval]` | 添加 Git 仓库 |
| `repo sync <project> <source>` | 手动同步 |
| `source add <project> <path>` | 添加本地路径信息源 |
| `source list <project>` | 列出项目信息源 |

## 技术栈

- **后端**: Node.js + TypeScript + Express 5
- **前端**: Vue 3 + Vite + vue-i18n
- **Discord**: discord.js v14
- **LLM**: @anthropic-ai/sdk + openai
- **图标**: @mdi/font (Material Design Icons)

</details>

## Introduction

Pharos is an intelligent codebase assistant that lives in your Discord server. When users @mention the bot with a question, it autonomously explores linked code repositories, documentation, and knowledge sources to provide accurate technical answers.

## Features

- **Discord Bot** — @mention triggered, autonomous codebase exploration
- **Multi-LLM** — Anthropic / OpenAI Chat Completions / OpenAI Responses API with priority-based fallback pool
- **Project-based** — Organize multiple knowledge sources per project, bind Discord channels to projects
- **Git Tracking** — Add repos by URL, auto clone/pull, scheduled sync, auto-generated indexes
- **Smart Indexing** — Agent analyzes repo structure and generates index docs, dramatically reducing exploration rounds for subsequent queries
- **Web Panel** — Vue 3 dashboard with dark/light theme, i18n (EN/ZH), full project/LLM/channel/history management
- **Live Progress** — Real-time exploration progress in Discord, full step-by-step trace in web panel
- **Security** — Brute force protection, rate limiting, security headers, persistent auth tokens

## Quick Start

```bash
git clone https://github.com/BeaconCat/Pharos.git
cd Pharos
pnpm install
pnpm build
```

The deploy package is generated in `deploy/`. Copy it anywhere and run:

```bash
cd deploy
./start.sh    # Linux/Mac
start.bat     # Windows
```

First launch auto-installs dependencies and creates config. Default password: `pharos`, port: `2468`.

## Deployment

### Requirements

- Node.js >= 20
- pnpm
- Git (for repository tracking)

### Production

```bash
# Build
pnpm build

# The deploy/ folder is self-contained
cp -r deploy /opt/pharos
cd /opt/pharos
./start.sh
```

### Docker

```bash
docker compose up -d
```

### Configuration

Edit `data/config.json` after first launch, or configure via the web panel at `http://your-server:2468`.

| Section | Description |
|---------|-------------|
| `discord.token` | Bot token from Discord Developer Portal |
| `discord.appId` | Application ID |
| `discord.adminRoles` | Role IDs that can use admin commands |
| `llm.providers` | LLM backends with enable/priority controls |
| `server.port` | HTTP port (default 2468) |
| `auth.password` | Web panel login password |
| `agent.maxIterations` | Max tool call rounds per query (default 20) |
| `agent.timeout` | Query timeout in ms (default 120000) |
| `agent.progressVerbosity` | Discord progress detail: silent / progress / detailed |

## Bot Commands

All commands are triggered by @mentioning the bot.

| Command | Access | Description |
|---------|--------|-------------|
| `help` | Everyone | Shows bot intro (admins see full command list) |
| `project create <name>` | Admin | Create a new project |
| `project list` | Admin | List all projects |
| `project bind <project>` | Admin | Bind current channel to a project |
| `project unbind <project>` | Admin | Unbind channel |
| `repo add <project> <url> [branch] [interval]` | Admin | Add & clone a Git repository |
| `repo sync <project> <source>` | Admin | Manually pull a source |
| `source add <project> <path>` | Admin | Add a local directory source |
| `source list <project>` | Admin | List sources in a project |

## Architecture

```
pharos/
├── src/
│   ├── index.ts              # Entry point
│   ├── bot/                  # Discord bot + admin commands
│   ├── agent/                # LLM agent executor + tools
│   ├── llm/                  # Provider adapters (Anthropic, OpenAI Chat, OpenAI Responses)
│   ├── server/               # Express API + middleware + routes
│   ├── services/             # Git sync, scheduler, indexer
│   ├── config/               # File-based config, history, logs
│   └── types/                # TypeScript interfaces
├── web/                      # Vue 3 frontend
├── assets/                   # Banner, icon
├── scripts/                  # Build/deploy scripts
├── deploy/                   # Production deploy package (after build)
└── data/                     # Runtime data (config, repos, history, logs)
```

## Security

- Login brute force protection (5 attempts → 5 min IP block)
- API rate limiting (60 req/min per IP)
- Security headers (X-Frame-Options, CSP, etc.)
- Request body size limit (1MB)
- Agent tools are read-only (no command execution)
- File access restricted to configured knowledge sources only

## License

MIT
