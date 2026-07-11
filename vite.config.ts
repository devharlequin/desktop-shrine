import { defineConfig, type Plugin } from 'vite';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Dev-only: POST a canvas dataURL to /__shot and it lands in tools/_shot.png. */
function shotPlugin(): Plugin {
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
    },
  };
}

export default defineConfig({
  base: './',
  build: { target: 'esnext' },
  clearScreen: false,
  plugins: [shotPlugin()],
});
