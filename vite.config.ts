import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({mode}) => {
  const packageJson = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8')) as { version?: string };
  const appVersion = packageJson.version ?? '0.0.0';
  const buildDate = new Date().toLocaleDateString('pt-BR');

  const repository = process.env.GITHUB_REPOSITORY;
  const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === 'true' && Boolean(repository);
  const repoName = repository?.split('/')[1] ?? '';

  const base = isGitHubPagesBuild && repoName ? `/${repoName}/` : '/';

  return {
    base,
    plugins: [react(), tailwindcss()],
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
      __BUILD_DATE__: JSON.stringify(buildDate),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            supabase: ['@supabase/supabase-js'],
            charts: ['recharts'],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Mantem compatibilidade com ambientes que exigem HMR desativado.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
