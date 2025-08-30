import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Dynamically loads every handler in this folder (except index.js) and calls one of:
 * - exported function itself
 * - exported.setupUserHandlers / setupHandlers / registerHandlers / register / run
 * so that command registration (/start, /add, /list, etc.) is guaranteed.
 */
export async function registerHandlers(bot) {
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.js') && f !== 'index.js');
  for (const file of files) {
    try {
      const modulePath = path.join(__dirname, file);
      const mod = await import(`file://${modulePath}`);
      
      if (typeof mod.default === 'function') { 
        mod.default(bot); 
        continue; 
      }
      
      const candidates = ['setupUserHandlers','setupHandlers','registerHandlers','register','run'];
      let called = false;
      for (const k of candidates) {
        if (mod && typeof mod[k] === 'function') { 
          mod[k](bot); 
          called = true; 
          break; 
        }
      }
      
      if (!called) {
        // Last resort: if module has only one function export, invoke it
        const onlyFn = Object.entries(mod||{}).find(([k,v]) => typeof v === 'function');
        if (onlyFn) onlyFn[1](bot);
      }
    } catch (e) {
      console.error('Handler load error for', file, e.message);
    }
  }
}
