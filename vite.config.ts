import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({mode}) => {
  const repository = process.env.GITHUB_REPOSITORY;
  const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === 'true' && Boolean(repository);
  const repoName = repository?.split('/')[1] ?? '';

  const base = isGitHubPagesBuild && repoName ? `/${repoName}/` : '/';

  return {
    base,
    plugins: [react(), tailwindcss()],
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
