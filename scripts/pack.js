import { cpSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { resolve, join } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const DEPLOY = resolve(ROOT, 'deploy');
const DIST = resolve(ROOT, 'dist');

console.log('[pack] Creating deploy package...');

try { rmSync(DEPLOY, { recursive: true, force: true }); } catch {}
mkdirSync(DEPLOY, { recursive: true });

cpSync(join(DIST, 'src'), join(DEPLOY, 'dist/src'), { recursive: true });
cpSync(join(DIST, 'public'), join(DEPLOY, 'dist/public'), { recursive: true });

cpSync(join(ROOT, 'config.example.json'), join(DEPLOY, 'config.example.json'));

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
const deployPkg = {
  name: pkg.name,
  version: pkg.version,
  type: 'module',
  scripts: {
    start: 'node dist/src/index.js',
  },
  engines: pkg.engines,
  dependencies: pkg.dependencies,
};
writeFileSync(join(DEPLOY, 'package.json'), JSON.stringify(deployPkg, null, 2));

cpSync(join(ROOT, 'pnpm-lock.yaml'), join(DEPLOY, 'pnpm-lock.yaml'));

writeFileSync(join(DEPLOY, 'start.sh'), `#!/bin/bash
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then
  echo "[Pharos] Installing dependencies..."
  pnpm install --prod --frozen-lockfile
fi
if [ ! -f data/config.json ]; then
  mkdir -p data
  cp config.example.json data/config.json
  echo "[Pharos] Created data/config.json from example. Edit it before starting."
  echo "[Pharos] Default password: pharos"
fi
node dist/src/index.js
`);

writeFileSync(join(DEPLOY, 'start.bat'), `@echo off
cd /d "%~dp0"
if not exist "node_modules" (
  echo [Pharos] Installing dependencies...
  pnpm install --prod --frozen-lockfile
)
if not exist "data\\config.json" (
  mkdir data 2>nul
  copy config.example.json data\\config.json
  echo [Pharos] Created data\\config.json from example. Edit it before starting.
  echo [Pharos] Default password: pharos
)
node dist\\src\\index.js
`);

console.log('[pack] Deploy package created at: deploy/');
console.log('[pack] Contents: dist/, config.example.json, package.json, pnpm-lock.yaml, start.sh, start.bat');
console.log('[pack] To deploy: copy deploy/ folder, then run start.sh (or start.bat)');
