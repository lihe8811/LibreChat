#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');

const checks = [
  {
    label: 'librechat-data-provider',
    file: 'packages/data-provider/dist/index.js',
    buildScript: 'build:data-provider',
  },
  {
    label: '@librechat/data-schemas',
    file: 'packages/data-schemas/dist/index.cjs',
    buildScript: 'build:data-schemas',
  },
  {
    label: '@librechat/api',
    file: 'packages/api/dist/index.js',
    buildScript: 'build:api',
  },
];

const missing = checks.filter((item) => !fs.existsSync(path.join(root, item.file)));

if (missing.length === 0) {
  process.exit(0);
}

for (const item of missing) {
  console.log(`[backend:dev] Missing ${item.label} build output (${item.file}). Building...`);
  const result = spawnSync('npm', ['run', item.buildScript], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
