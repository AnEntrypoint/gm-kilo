import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function GmPlugin({ directory }) {
  const agentMd = join(__dirname, '..', 'agents', 'gm.md');
  const prdFile = join(directory, '.prd');

  return {
    'experimental.chat.system.transform': async (input, output) => {
      try {
        const rules = readFileSync(agentMd, 'utf-8');
        if (rules) output.system.unshift(rules);
      } catch (e) {}
      try {
        if (existsSync(prdFile)) {
          const prd = readFileSync(prdFile, 'utf-8').trim();
          if (prd) output.system.push('\nPENDING WORK (.prd):\n' + prd);
        }
      } catch (e) {}
    }
  };
}
