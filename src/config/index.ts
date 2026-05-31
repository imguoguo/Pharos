import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, appendFileSync } from 'fs';
import { resolve, join } from 'path';
import type { AppConfig } from '../types/config.js';
import type { ConversationEntry } from '../types/agent.js';

const DATA_DIR = resolve(process.cwd(), 'data');
const CONFIG_PATH = resolve(DATA_DIR, 'config.json');
const HISTORY_DIR = resolve(DATA_DIR, 'history');
const LOG_DIR = resolve(DATA_DIR, 'logs');

let config: AppConfig | null = null;

function ensureDirs(): void {
  for (const dir of [DATA_DIR, HISTORY_DIR, LOG_DIR]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}

export function getDataDir(): string {
  return DATA_DIR;
}

export function loadConfig(): AppConfig {
  ensureDirs();
  if (!existsSync(CONFIG_PATH)) {
    const examplePath = resolve(process.cwd(), 'config.example.json');
    if (existsSync(examplePath)) {
      const example = readFileSync(examplePath, 'utf-8');
      writeFileSync(CONFIG_PATH, example, 'utf-8');
    } else {
      throw new Error(`Config file not found: ${CONFIG_PATH}`);
    }
  }
  const raw = readFileSync(CONFIG_PATH, 'utf-8');
  config = JSON.parse(raw) as AppConfig;
  return config;
}

export function getConfig(): AppConfig {
  if (!config) return loadConfig();
  return config;
}

export function saveConfig(): void {
  if (!config) return;
  ensureDirs();
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export function reloadConfig(): AppConfig {
  config = null;
  return loadConfig();
}

export function loadChannelHistory(channelId: string): ConversationEntry[] {
  ensureDirs();
  const path = join(HISTORY_DIR, `${channelId}.json`);
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, 'utf-8'));
}

export function saveChannelHistory(channelId: string, entries: ConversationEntry[]): void {
  ensureDirs();
  const path = join(HISTORY_DIR, `${channelId}.json`);
  writeFileSync(path, JSON.stringify(entries, null, 2), 'utf-8');
}

export function appendHistory(entry: ConversationEntry): void {
  const entries = loadChannelHistory(entry.channelId);
  entries.push(entry);
  if (entries.length > 200) entries.splice(0, entries.length - 200);
  saveChannelHistory(entry.channelId, entries);
}

export function listChannelsWithHistory(): string[] {
  ensureDirs();
  return readdirSync(HISTORY_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''));
}

export function appendLog(level: string, message: string): void {
  ensureDirs();
  const date = new Date().toISOString().split('T')[0];
  const logPath = join(LOG_DIR, `${date}.log`);
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}\n`;
  appendFileSync(logPath, line, 'utf-8');
}
