import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async ({ project, client, $, directory, worktree }) => {
  const pluginDir = __dirname;
  let agentRules = '';
  let thornsPromise = null;
  let thornsOutput = '';

  const loadAgentRules = () => {
    if (agentRules) return agentRules;
    const agentMd = path.join(pluginDir, 'agents', 'gm.md');
    try { agentRules = fs.readFileSync(agentMd, 'utf-8'); } catch (e) {}
    return agentRules;
  };

  // Start thorns in background immediately on plugin load
  const startThorns = () => {
    if (thornsPromise) return thornsPromise;
    thornsPromise = new Promise((resolve) => {
      exec('bun x mcp-thorns@latest', {
        encoding: 'utf-8', cwd: directory, timeout: 180000
      }, (err, stdout) => {
        thornsOutput = err ? '' : (stdout || '').trim();
        resolve(thornsOutput);
      });
    });
    return thornsPromise;
  };

  const prdFile = path.join(directory, '.prd');

  return {
    'experimental.chat.system.transform': async (input, output) => {
      const rules = loadAgentRules();
      const prd = fs.existsSync(prdFile) ? fs.readFileSync(prdFile, 'utf-8').trim() : '';
      let content = rules || '';
      if (prd) content += '\n\nPENDING WORK (.prd):\n' + prd;
      // Await thorns fully on first call (starts and waits), cached on subsequent calls
      const thorns = await startThorns();
      if (thorns) content += '\n\n=== Repository Analysis (mcp-thorns) ===\n' + thorns;
      if (content) output.system.push(content);
    }
  };
};
