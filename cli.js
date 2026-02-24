#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const homeDir = process.env.HOME || process.env.USERPROFILE || os.homedir();
const destDir = process.platform === 'win32'
  ? path.join(homeDir, 'AppData', 'Roaming', 'kilo', 'plugin')
  : path.join(homeDir, '.config', 'kilo', 'plugin');

const srcDir = __dirname;
const isUpgrade = fs.existsSync(destDir);

console.log(isUpgrade ? 'Upgrading gm-kilo...' : 'Installing gm-kilo...');

try {
  fs.mkdirSync(destDir, { recursive: true });

  const filesToCopy = [
    ['agents', 'agents'],
    ['hooks', 'hooks'],
    ['skills', 'skills'],
    ['scripts', 'scripts'],
    ['index.js', 'index.js'],
    ['gm.js', 'gm.js'],
    ['kilocode.json', 'kilocode.json'],
    ['package.json', 'package.json'],
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

  try {
    console.log('Installing dependencies...');
    execSync('npm install', { cwd: destDir, stdio: 'inherit' });
  } catch (e) {
    console.warn('npm install encountered an issue, but installation may still work');
  }

  const destPath = process.platform === 'win32'
    ? destDir.replace(/\\/g, '/')
    : destDir;
  console.log(`✓ gm-kilo ${isUpgrade ? 'upgraded' : 'installed'} to ${destPath}`);
  console.log('Restart Kilo CLI to activate.');
} catch (e) {
  console.error('Installation failed:', e.message);
  process.exit(1);
}
