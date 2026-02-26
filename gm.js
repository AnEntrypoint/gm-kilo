const fs = require('fs');
const path = require('path');

const GmPlugin = async ({ project, client, $, directory, worktree }) => {
  const pluginDir = __dirname;
  let agentRules = '';

  const loadAgentRules = () => {
    if (agentRules) return agentRules;
    const agentMd = path.join(pluginDir, 'agents', 'gm.md');
    try { agentRules = fs.readFileSync(agentMd, 'utf-8'); } catch (e) {}
    return agentRules;
  };

  const runSessionIdle = async () => {
    if (!client || !client.tui) return;
    const blockReasons = [];
    try {
      const status = await $`git status --porcelain`.timeout(2000).nothrow();
      if (status.exitCode === 0 && status.stdout.trim().length > 0)
        blockReasons.push('Git: Uncommitted changes exist');
    } catch (e) {}
    try {
      const ahead = await $`git rev-list --count @{u}..HEAD`.timeout(2000).nothrow();
      if (ahead.exitCode === 0 && parseInt(ahead.stdout.trim()) > 0)
        blockReasons.push('Git: ' + ahead.stdout.trim() + ' commit(s) not pushed');
    } catch (e) {}
    try {
      const behind = await $`git rev-list --count HEAD..@{u}`.timeout(2000).nothrow();
      if (behind.exitCode === 0 && parseInt(behind.stdout.trim()) > 0)
        blockReasons.push('Git: ' + behind.stdout.trim() + ' upstream change(s) not pulled');
    } catch (e) {}
    const prdFile = path.join(directory, '.prd');
    if (fs.existsSync(prdFile)) {
      const prd = fs.readFileSync(prdFile, 'utf-8').trim();
      if (prd.length > 0) blockReasons.push('Work items remain in .prd:\n' + prd);
    }
    if (blockReasons.length > 0) throw new Error(blockReasons.join(' | '));
    const filesToRun = [];
    const evalJs = path.join(directory, 'eval.js');
    if (fs.existsSync(evalJs)) filesToRun.push('eval.js');
    const evalsDir = path.join(directory, 'evals');
    if (fs.existsSync(evalsDir) && fs.statSync(evalsDir).isDirectory()) {
      filesToRun.push(...fs.readdirSync(evalsDir)
        .filter(f => f.endsWith('.js') && !path.join(evalsDir, f).includes('/lib/'))
        .sort().map(f => path.join('evals', f)));
    }
    for (const file of filesToRun) {
      try { await $`node ${file}`.timeout(60000); } catch (e) {
        throw new Error('eval error: ' + e.message + '\n' + (e.stdout || '') + '\n' + (e.stderr || ''));
      }
    }
  };

  const prdFile = path.join(directory, '.prd');

  return {
    onLoad: async () => {
      console.log('✓ gm plugin loaded');
    },

    getSystemPrompt: async () => {
      const rules = loadAgentRules();
      const prd = fs.existsSync(prdFile) ? fs.readFileSync(prdFile, 'utf-8').trim() : '';
      let prompt = rules || '';
      if (prd) prompt += '\n\nPENDING WORK (.prd):\n' + prd;
      return prompt;
    },

    onSessionEnd: async () => {
      const prd = fs.existsSync(prdFile) ? fs.readFileSync(prdFile, 'utf-8').trim() : '';
      if (prd) throw new Error('Work items remain in .prd - commit changes before exiting');
    }
  };
};

module.exports = { GmPlugin };
