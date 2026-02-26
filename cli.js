#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

const homeDir = process.env.HOME || process.env.USERPROFILE || os.homedir();
const kiloConfigDir = path.join(homeDir, '.config', 'kilo');
const srcDir = __dirname;
const pluginMarker = path.join(kiloConfigDir, 'plugins', 'gm-kilo.mjs');
const isUpgrade = fs.existsSync(pluginMarker);

console.log(isUpgrade ? 'Upgrading gm-kilo...' : 'Installing gm-kilo...');

try {
  fs.mkdirSync(path.join(kiloConfigDir, 'plugins'), { recursive: true });
  fs.mkdirSync(path.join(kiloConfigDir, 'agents'), { recursive: true });

  function copyRecursive(src, dst) {
    if (!fs.existsSync(src)) return;
    if (fs.statSync(src).isDirectory()) {
      fs.mkdirSync(dst, { recursive: true });
      fs.readdirSync(src).forEach(f => copyRecursive(path.join(src, f), path.join(dst, f)));
    } else {
      fs.copyFileSync(src, dst);
    }
  }

  // Install ESM plugin for kilo auto-loading from plugins directory
  fs.copyFileSync(path.join(srcDir, 'gm-kilo.mjs'), path.join(kiloConfigDir, 'plugins', 'gm-kilo.mjs'));

  // Copy agents into kilo config dir
  copyRecursive(path.join(srcDir, 'agents'), path.join(kiloConfigDir, 'agents'));

  // Write/fix kilocode.json — set default_agent, fix $schema
  const kiloJsonPath = path.join(kiloConfigDir, 'kilocode.json');
  let kiloConfig = {};
  try {
    const raw = fs.readFileSync(kiloJsonPath, 'utf-8');
    kiloConfig = JSON.parse(raw);
    // Fix corrupted $schema key (written as "" in older versions)
    if (kiloConfig['']) { delete kiloConfig['']; }
  } catch (e) {}
  // Remove stale MCP config (no longer used)
  delete kiloConfig.mcp;
  kiloConfig['$schema'] = 'https://kilo.ai/config.json';
  kiloConfig.default_agent = 'gm';
  // Remove stale local-path plugin reference
  if (Array.isArray(kiloConfig.plugin)) {
    kiloConfig.plugin = kiloConfig.plugin.filter(p => !path.isAbsolute(p) && !p.startsWith('C:') && !p.startsWith('/'));
    if (kiloConfig.plugin.length === 0) delete kiloConfig.plugin;
  }
  fs.writeFileSync(kiloJsonPath, JSON.stringify(kiloConfig, null, 2) + '\n');

  // Clean old AppData install location (no longer used by kilo)
  const oldDir = process.platform === 'win32'
    ? path.join(homeDir, 'AppData', 'Roaming', 'kilo', 'plugin') : null;
  if (oldDir && fs.existsSync(oldDir)) {
    try { fs.rmSync(oldDir, { recursive: true, force: true }); } catch (e) {}
  }

  // Install skills globally via the skills package (supports all agents)
  const { execSync: execSync2 } = require('child_process');
  try {
    execSync2('bunx skills add AnEntrypoint/plugforge --full-depth --all --global --yes', { stdio: 'inherit' });
  } catch (e) {
    console.warn('Warning: skills install failed (non-fatal):', e.message);
  }

  console.log(`✓ gm-kilo ${isUpgrade ? 'upgraded' : 'installed'} to ${kiloConfigDir}`);
  console.log('Restart Kilo CLI to activate.');
} catch (e) {
  console.error('Installation failed:', e.message);
  process.exit(1);
}
