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
  const runCodeSearch = (query) => new Promise((resolve) => {
    const q = query.replace(/"/g, '\\"').substring(0, 200);
    exec('bun x codebasesearch@latest "' + q + '"', {
      encoding: 'utf-8', cwd: directory, timeout: 300000
    }, (err, stdout) => {
      if (err) return resolve('');
      const lines = (stdout || '').split('\n');
      const start = lines.findIndex(l => l.includes('Searching for:'));
      resolve(start >= 0 ? lines.slice(start).join('\n').trim() : (stdout || '').trim());
    });
  });
  const getLastUserMessage = (msgs) => {
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (m.role === 'user') {
        const parts = Array.isArray(m.content) ? m.content : [m.content];
        const text = parts.map(p => typeof p === 'string' ? p : (p?.text || '')).join(' ').trim();
        if (text) return text;
      }
    }
    return '';
  };
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
        const userQuery = getLastUserMessage(msgs);
        const [thorns, search] = await Promise.all([
          runThorns(),
          userQuery ? runCodeSearch(userQuery) : Promise.resolve('')
        ]);
        if (thorns) content += '\n\n=== Repository Analysis (mcp-thorns) ===\n' + thorns;
        if (search) content += '\n\n=== Semantic Code Search Results ===\n' + search;
      }
      if (content) output.system.push(content);
    }
  };
};
