# Pharos

Discord AI 助手，支持多 LLM 后端接入，基于可配置知识源回答代码库相关问题。

## 功能

- Discord Bot：@mention 触发，自动探索代码库并回答问题
- 多 LLM 支持：Anthropic API / OpenAI Chat Completions / OpenAI Responses API
- 知识源管理：支持文件夹、文件、Git 仓库等任意文本知识源
- Web 管理面板：知识源配置、LLM 后端管理、频道权限、对话历史、状态监控
- Agent 沙箱：隔离环境中执行代码探索、构建、测试

## 技术栈

- 后端：Node.js + TypeScript + Express
- 前端：Vue 3 + Vite 7
- Discord：discord.js v14
- LLM：@anthropic-ai/sdk + openai

## 开发

```bash
pnpm install
cp config.example.json config.json
pnpm dev
```

## 构建

```bash
pnpm build
pnpm start
```
