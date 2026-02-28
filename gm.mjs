import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async ({ project, client, $, directory, worktree }) => {
  const pluginDir = __dirname;
  let agentRules = '';
  let thornsOutput = '';
  let thornsReady = false;

  const loadAgentRules = () => {
    if (agentRules) return agentRules;
    const agentMd = path.join(pluginDir, 'agents', 'gm.md');
    try { agentRules = fs.readFileSync(agentMd, 'utf-8'); } catch (e) {}
    return agentRules;
  };

  const runThorns = () => {
    if (thornsReady) return thornsOutput;
    thornsReady = true;
    try {
      const out = execSync('bun x mcp-thorns@latest', {
        encoding: 'utf-8', cwd: directory, timeout: 180000,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      thornsOutput = out.trim();
    } catch (e) {
      thornsOutput = '=== mcp-thorns ===\nSkipped (' + e.message.split('\n')[0] + ')';
    }
    return thornsOutput;
  };

  const runCodeSearch = (query) => {
    if (!query || !directory) return '';
    try {
      const q = query.replace(/"/g, '\\"').substring(0, 200);
      const out = execSync('bun x codebasesearch@latest "' + q + '"', {
        encoding: 'utf-8', cwd: directory, timeout: 55000,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      const lines = out.split('\n');
      const start = lines.findIndex(l => l.includes('Searching for:'));
      return start >= 0 ? lines.slice(start).join('\n').trim() : out.trim();
    } catch (e) { return ''; }
  };

  const getLastUserMessage = (input) => {
    try {
      const msgs = input?.messages || [];
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (m.role === 'user') {
          const parts = Array.isArray(m.content) ? m.content : [m.content];
          const text = parts.map(p => typeof p === 'string' ? p : (p?.text || '')).join(' ').trim();
          if (text) return text;
        }
      }
    } catch (e) {}
    return '';
  };

  const prdFile = path.join(directory, '.prd');

  return {
    'experimental.chat.system.transform': async (input, output) => {
      const rules = loadAgentRules();
      const prd = fs.existsSync(prdFile) ? fs.readFileSync(prdFile, 'utf-8').trim() : '';
      let content = rules || '';
      if (prd) content += '\n\nPENDING WORK (.prd):\n' + prd;
      const thorns = runThorns();
      if (thorns) content += '\n\n=== Repository Analysis (mcp-thorns) ===\n' + thorns;
      const lastMsg = getLastUserMessage(input);
      if (lastMsg) {
        const searchResults = runCodeSearch(lastMsg);
        if (searchResults) content += '\n\n=== Semantic code search results ===\n' + searchResults;
      }
      if (content) output.system.push(content);
    }
  };
};
