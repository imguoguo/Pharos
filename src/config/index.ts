import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { AppConfig } from '../types/config.js';

const CONFIG_PATH = resolve(process.cwd(), 'config.json');

let config: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(`Config file not found: ${CONFIG_PATH}`);
  }
  const raw = readFileSync(CONFIG_PATH, 'utf-8');
  config = JSON.parse(raw) as AppConfig;
  return config;
}

export function getConfig(): AppConfig {
  if (!config) {
    return loadConfig();
  }
  return config;
}

export function reloadConfig(): AppConfig {
  config = null;
  return loadConfig();
}
