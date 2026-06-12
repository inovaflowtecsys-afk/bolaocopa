import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { VitePWA } from 'vite-plugin-pwa';
import ws from 'ws';
import {defineConfig, loadEnv} from 'vite';

const RESET_PASSWORD = '0102bolaoCop@';

if (!globalThis.WebSocket) {
  globalThis.WebSocket = ws as unknown as typeof globalThis.WebSocket;
}

const readJsonBody = async (req: import('node:http').IncomingMessage) => {
  const chunks: Uint8Array[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf-8');
  return raw ? JSON.parse(raw) : {};
};

const getAllowedCorsOrigin = (origin?: string) => {
  if (!origin) return null;

  const allowedOrigins = new Set([
    'https://app.bolaocopa.inovaflowtec.com.br',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]);

  return allowedOrigins.has(origin) ? origin : null;
};

const applyDevCorsHeaders = (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => {
  const allowedOrigin = getAllowedCorsOrigin(req.headers.origin);

  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
};

const createAdminApiPlugin = (env: Record<string, string>) => ({
  name: 'local-admin-api',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use('/api/reset-password', async (req, res, next) => {
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        applyDevCorsHeaders(req, res);
        res.end();
        return;
      }

      if (req.method !== 'POST') {
        next();
        return;
      }

      try {
        const { userId } = await readJsonBody(req);

        if (!userId) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'userId obrigatorio' }));
          return;
        }

        const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
        const serviceKey = env.SUPABASE_SERVICE_KEY;

        if (!supabaseUrl || !serviceKey) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            error: 'Servidor sem SUPABASE_URL/VITE_SUPABASE_URL ou SUPABASE_SERVICE_KEY configuradas para reset administrativo.',
          }));
          return;
        }

        const supabase = createClient(supabaseUrl, serviceKey);

        const { error } = await supabase.auth.admin.updateUserById(userId, {
          password: RESET_PASSWORD,
        });

        if (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: error.message }));
          return;
        }

        const { error: profileError } = await supabase
          .from('users')
          .update({ senha_provisoria: true })
          .eq('id', userId);

        if (profileError) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: profileError.message }));
          return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro interno ao resetar senha.';
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: message }));
      }
    });

    server.middlewares.use('/api/delete-user', async (req, res, next) => {
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        applyDevCorsHeaders(req, res);
        res.end();
        return;
      }

      if (req.method !== 'POST') {
        next();
        return;
      }

      try {
        const { userId, accessToken } = await readJsonBody(req);

        if (!userId) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'userId obrigatorio' }));
          return;
        }

        const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
        const serviceKey = env.SUPABASE_SERVICE_KEY;

        if (!supabaseUrl || !serviceKey) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            error: 'Servidor sem SUPABASE_URL/VITE_SUPABASE_URL ou SUPABASE_SERVICE_KEY configuradas para exclusao administrativa.',
          }));
          return;
        }

        const supabase = createClient(supabaseUrl, serviceKey);

        const token = accessToken || req.headers.authorization?.replace(/^Bearer\s+/i, '');
        if (!token) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Sessao administrativa obrigatoria.' }));
          return;
        }

        const { data: authData, error: authError } = await supabase.auth.getUser(token);
        if (authError || !authData.user) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Sessao invalida.' }));
          return;
        }

        const { data: adminProfile, error: adminError } = await supabase
          .from('users')
          .select('is_admin')
          .eq('id', authData.user.id)
          .maybeSingle();

        if (adminError) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: adminError.message }));
          return;
        }

        if (!adminProfile?.is_admin) {
          res.statusCode = 403;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Apenas administradores podem excluir usuarios.' }));
          return;
        }

        const { error: profileError } = await supabase
          .from('users')
          .delete()
          .eq('id', userId);

        if (profileError) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: profileError.message }));
          return;
        }

        const { error } = await supabase.auth.admin.deleteUser(userId);

        if (error && !/not found|does not exist|user not found/i.test(error.message)) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: error.message }));
          return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro interno ao excluir usuario.';
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: message }));
      }
    });

    server.middlewares.use('/api/match-bets', async (req, res, next) => {
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        applyDevCorsHeaders(req, res);
        res.end();
        return;
      }

      if (req.method !== 'POST') {
        next();
        return;
      }

      try {
        const { matchId, accessToken } = await readJsonBody(req);

        if (!matchId) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'matchId obrigatorio' }));
          return;
        }

        const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
        const serviceKey = env.SUPABASE_SERVICE_KEY;

        if (!supabaseUrl || !serviceKey) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            error: 'Servidor sem SUPABASE_URL/VITE_SUPABASE_URL ou SUPABASE_SERVICE_KEY configuradas para carregar palpites.',
          }));
          return;
        }

        const supabase = createClient(supabaseUrl, serviceKey);
        const token = accessToken || req.headers.authorization?.replace(/^Bearer\s+/i, '');

        if (!token) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Sessao obrigatoria para carregar palpites.' }));
          return;
        }

        const { data: authData, error: authError } = await supabase.auth.getUser(token);
        if (authError || !authData.user) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Sessao invalida.' }));
          return;
        }

        const [{ data: requester, error: requesterError }, { data: match, error: matchError }] = await Promise.all([
          supabase.from('users').select('id,is_admin').eq('id', authData.user.id).maybeSingle(),
          supabase.from('matches').select('id,status').eq('id', matchId).maybeSingle(),
        ]);

        if (requesterError || matchError) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            error: requesterError?.message || matchError?.message || 'Erro ao carregar dados do jogo.',
          }));
          return;
        }

        if (!requester) {
          res.statusCode = 403;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Usuario nao cadastrado para visualizar palpites.' }));
          return;
        }

        if (!match) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Partida nao encontrada.' }));
          return;
        }

        const { data: bets, error: betsError } = await supabase
          .from('bets')
          .select('*')
          .eq('match_id', matchId);
        if (betsError) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: betsError.message }));
          return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ bets: bets ?? [], canSeeAllBets: true }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro interno ao carregar palpites.';
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: message }));
      }
    });
  },
});

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, __dirname, '');
  const packageJson = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8')) as { version?: string };
  const appVersion = packageJson.version ?? '0.0.0';
  const buildDate = '11/06/2026';

  const repository = env.GITHUB_REPOSITORY;
  const isGitHubPagesBuild = env.GITHUB_ACTIONS === 'true' && Boolean(repository);
  const repoName = repository?.split('/')[1] ?? '';
  const configuredBasePath = env.BASE_PATH;

  const base = configuredBasePath
    ? (configuredBasePath.endsWith('/') ? configuredBasePath : `${configuredBasePath}/`)
    : isGitHubPagesBuild && repoName
      ? `/${repoName}/`
      : '/';

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      createAdminApiPlugin(env),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.svg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'maskable-icon-512x512.png',
        ],
        manifest: {
          id: '/',
          name: `Bolão da Copa ${env.VITE_APP_YEAR || '2026'}`,
          short_name: 'Bolão da Copa',
          description: 'Bolão da Copa com palpites, ranking e pontuação em tempo real.',
          theme_color: '#0f172a',
          background_color: '#f8fafc',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          lang: 'pt-BR',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'maskable-icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api\//],
          skipWaiting: true,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.(png|jpg|jpeg|svg|webp|woff2)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'static-assets',
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
      }),
    ],
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
      hmr: env.DISABLE_HMR !== 'true',
    },
  };
});
