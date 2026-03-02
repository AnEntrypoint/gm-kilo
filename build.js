#!/usr/bin/env node
// Builds per-platform output directories for plugforge
// Usage: node build.js ./build
// Output: ./build/gm-{platform}/ for each platform

const fs = require('fs');
const path = require('path');

const outDir = process.argv[2] || './build';
const srcDir = __dirname;

const platforms = [
  { platform: 'cc',          name: 'Claude Code',        npmName: 'gm-cc',          bin: 'gm-cc' },
  { platform: 'gc',          name: 'Gemini CLI',          npmName: 'gm-gc',          bin: 'gm-gc' },
  { platform: 'oc',          name: 'OpenCode',            npmName: 'gm-oc',          bin: 'gm-oc' },
  { platform: 'kilo',        name: 'Kilo CLI',            npmName: 'gm-kilo',        bin: 'gm-kilo' },
  { platform: 'vscode',      name: 'VS Code',             npmName: 'gm-vscode',      bin: 'gm-vscode' },
  { platform: 'cursor',      name: 'Cursor',              npmName: 'gm-cursor',      bin: 'gm-cursor' },
  { platform: 'zed',         name: 'Zed',                 npmName: 'gm-zed',         bin: 'gm-zed' },
  { platform: 'jetbrains',   name: 'JetBrains',           npmName: 'gm-jetbrains',   bin: 'gm-jetbrains' },
  { platform: 'copilot-cli', name: 'GitHub Copilot CLI',  npmName: 'gm-copilot-cli', bin: 'gm-copilot-cli' },
];

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

const publishWorkflow = `name: Publish to npm

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          token: \${{ secrets.GH_PAT || github.token }}

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'

      - name: Configure git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Bump patch version
        run: |
          LAST_MSG=\$(git log -1 --pretty=%s)
          if echo "\$LAST_MSG" | grep -qE '^v[0-9]+\\.[0-9]+\\.[0-9]+\$'; then
            echo "SKIP_BUMP=true" >> \$GITHUB_ENV
          else
            npm version patch --no-git-tag-version
            NEW_VERSION=\$(jq -r '.version' package.json)
            git add package.json
            git commit -m "v\$NEW_VERSION"
            git push
          fi

      - name: Publish to npm
        run: |
          PACKAGE=\$(jq -r '.name' package.json)
          VERSION=\$(jq -r '.version' package.json)
          PUBLISHED=\$(npm view "\$PACKAGE@\$VERSION" version 2>/dev/null || echo "")
          if [ "\$PUBLISHED" = "\$VERSION" ]; then
            echo "\$PACKAGE@\$VERSION already published - skipping"
            exit 0
          fi
          npm publish --access public
        env:
          NODE_AUTH_TOKEN: \${{ secrets.NPM_TOKEN }}
`;

const srcPkg = JSON.parse(fs.readFileSync(path.join(srcDir, 'package.json'), 'utf-8'));

for (const { platform, name, npmName, bin } of platforms) {
  const dest = path.join(outDir, `gm-${platform}`);
  fs.mkdirSync(dest, { recursive: true });

  // Copy shared files
  for (const d of ['agents', 'hooks', 'skills']) copyDir(path.join(srcDir, d), path.join(dest, d));
  for (const f of ['.mcp.json', 'README.md', 'LICENSE']) {
    const s = path.join(srcDir, f);
    if (fs.existsSync(s)) fs.copyFileSync(s, path.join(dest, f));
  }

  // Copy platform-specific overrides if they exist
  const platformOverride = path.join(srcDir, 'platforms', platform);
  if (fs.existsSync(platformOverride)) copyDir(platformOverride, dest);

  // Copy install script
  const installSrc = platform === 'kilo'
    ? path.join(srcDir, 'cli.js')
    : path.join(srcDir, 'scripts', 'postinstall.js');
  if (fs.existsSync(installSrc)) fs.copyFileSync(installSrc, path.join(dest, 'install.js'));

  // Write package.json
  const pkg = {
    name: npmName,
    version: srcPkg.version || '1.0.0',
    description: `GM agent for ${name}`,
    author: srcPkg.author || 'AnEntrypoint',
    license: 'MIT',
    bin: { [bin]: './install.js' },
    scripts: { postinstall: 'node install.js' },
    publishConfig: { access: 'public' },
    repository: { type: 'git', url: `https://github.com/AnEntrypoint/gm-${platform}.git` },
    keywords: ['gm', 'agent', platform],
    engines: { node: '>=16.0.0' },
  };
  fs.writeFileSync(path.join(dest, 'package.json'), JSON.stringify(pkg, null, 2), 'utf-8');

  // Write publish workflow
  fs.mkdirSync(path.join(dest, '.github', 'workflows'), { recursive: true });
  fs.writeFileSync(path.join(dest, '.github', 'workflows', 'publish-npm.yml'), publishWorkflow, 'utf-8');

  console.log(`Built gm-${platform} → ${dest}`);
}

console.log('Done.');
