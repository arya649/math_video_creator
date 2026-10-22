import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

// While the dev server runs, the page can save renders into renders/.
function saver(): Plugin {
  return {
    name: 'save-renders',
    configureServer(server) {
      server.middlewares.use('/__save', (req, res) => {
        const params = new URL(req.url ?? '', 'http://x').searchParams;
        const name = params.get('name') ?? 'out.bin';
        const safe = name.replace(/[^\w.\-]/g, '_');
        // With a project: into that project's folder (made voices); else into renders/.
        const project = params.get('project')?.replace(/[^\w\-]/g, '_');
        const dir = project ? resolve('public/projects', project) : resolve('renders');
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          mkdirSync(dir, { recursive: true });
          writeFileSync(resolve(dir, safe), Buffer.concat(chunks));
          res.end('ok');
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [saver()],
  build: {
    rollupOptions: {
      input: { main: resolve('index.html'), catalog: resolve('catalog.html') },
    },
  },
});
