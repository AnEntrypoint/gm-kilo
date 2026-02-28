import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default async ({ directory }) => {
  const agentsDir = join(__dirname, 'agents');
  const loadAgentRules = () => {
    try { return readFileSync(join(agentsDir, 'gm.md'), 'utf-8'); } catch (e) { return ''; }
  };
  const runThorns = () => new Promise((resolve) => {
    exec('bun x mcp-thorns@latest', {
      encoding: 'utf-8', cwd: directory, timeout: 180000
    }, (err, stdout) => resolve(err ? '' : (stdout || '').trim()));
  });
  const prdFile = join(directory, '.prd');
  return {
    'experimental.chat.system.transform': async (input, output) => {
      const rules = loadAgentRules();
      const prd = existsSync(prdFile) ? readFileSync(prdFile, 'utf-8').trim() : '';
      let content = rules || '';
      if (prd) content += '\n\nPENDING WORK (.prd):\n' + prd;
      const msgs = input?.messages || [];
      const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
      const hasNewUserPrompt = !lastMsg || lastMsg.role === 'user';
      if (hasNewUserPrompt) {
        const thorns = await runThorns();
        if (thorns) content += '\n\n=== Repository Analysis (mcp-thorns) ===\n' + thorns;
      }
      if (content) output.system.push(content);
    }
  };
};
