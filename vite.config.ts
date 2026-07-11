import { defineConfig, type Plugin } from 'vite';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Dev-only helpers:
 *  - POST a canvas dataURL to /__shot -> lands in tools/_shot.png
 *  - POST a command string to /__cmd -> queued; the app polls GET /__cmd
 *    (lets tests drive the real Tauri webview: "shot", "drop:<path>", "hour:<n>") */
function shotPlugin(): Plugin {
  const cmds: string[] = [];
  return {
    name: 'shrine-shot',
    configureServer(server) {
      server.middlewares.use('/__shot', (req, res) => {
        let body = '';
        req.on('data', c => (body += c));
        req.on('end', () => {
          const b64 = body.split(',', 2)[1] ?? '';
          writeFileSync(join(__dirname, 'tools', '_shot.png'), Buffer.from(b64, 'base64'));
          res.end('ok');
        });
      });
      server.middlewares.use('/__cmd', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', c => (body += c));
          req.on('end', () => { cmds.push(body); res.end('queued'); });
        } else {
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(cmds.splice(0)));
        }
      });
    },
  };
}

export default defineConfig({
  base: './',
  build: { target: 'esnext' },
  clearScreen: false,
  plugins: [shotPlugin()],
});
