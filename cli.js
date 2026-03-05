#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const homeDir = process.env.HOME || process.env.USERPROFILE || os.homedir();
const destDir = process.platform === 'win32'
  ? path.join(homeDir, 'AppData', 'Roaming', 'kilo')
  : path.join(homeDir, '.config', 'kilo');

const srcDir = __dirname;
const isUpgrade = fs.existsSync(path.join(destDir, 'agents', 'gm.md'));

console.log(isUpgrade ? 'Upgrading gm-kilo...' : 'Installing gm-kilo...');

try {
  fs.mkdirSync(destDir, { recursive: true });

  const filesToCopy = [
    ['agents', 'agents'],
    ['hooks', 'hooks'],
    ['skills', 'skills'],
    ['index.mjs', 'index.mjs'],
    ['gm.mjs', 'gm.mjs'],
    ['kilocode.json', 'kilocode.json'],
    ['.mcp.json', '.mcp.json'],
    ['README.md', 'README.md'],
    ['LICENSE', 'LICENSE'],
    ['CONTRIBUTING.md', 'CONTRIBUTING.md'],
    ['.gitignore', '.gitignore'],
    ['.editorconfig', '.editorconfig']
  ];

  function copyRecursive(src, dst) {
    if (!fs.existsSync(src)) return;
    if (fs.statSync(src).isDirectory()) {
      fs.mkdirSync(dst, { recursive: true });
      fs.readdirSync(src).forEach(f => copyRecursive(path.join(src, f), path.join(dst, f)));
    } else {
      fs.copyFileSync(src, dst);
    }
  }

  filesToCopy.forEach(([src, dst]) => copyRecursive(path.join(srcDir, src), path.join(destDir, dst)));

  // Also write plugin/ directory - Kilo loads from ~/.config/kilo/plugin/ as a local file plugin
  const pluginDir = path.join(destDir, 'plugin');
  fs.mkdirSync(pluginDir, { recursive: true });
  const gmMjsSrc = path.join(srcDir, 'gm.mjs');
  if (fs.existsSync(gmMjsSrc)) {
    fs.copyFileSync(gmMjsSrc, path.join(pluginDir, 'gm.mjs'));
  }
  fs.writeFileSync(path.join(pluginDir, 'index.js'), "export { default } from './gm.mjs';\n", 'utf-8');

  const destPath = process.platform === 'win32'
    ? destDir.replace(/\\/g, '/')
    : destDir;
  console.log(`✓ gm-kilo ${isUpgrade ? 'upgraded' : 'installed'} to ${destPath}`);
  console.log('Restart Kilo CLI to activate.');
  console.log('Run "kilo agents list" to verify your agent is available.');
} catch (e) {
  console.error('Installation failed:', e.message);
  process.exit(1);
}
