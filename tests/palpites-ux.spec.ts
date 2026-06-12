import { expect, test } from '@playwright/test';
import { createUserThroughApi } from './supabase-test-utils';

async function login(page: import('@playwright/test').Page, prefix: string) {
  const credentials = await createUserThroughApi(prefix);

  await page.goto('/');
  await page.getByLabel('E-mail').fill(credentials.email);
  await page.getByLabel('Senha').fill(credentials.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText('Grupo oficial no WhatsApp')).toBeVisible();

  return credentials;
}

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.project.name === 'pwa-standalone') {
    await page.addInitScript(() => {
      const originalMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = (query: string) => {
        if (query.includes('display-mode: standalone')) {
          return {
            matches: true,
            media: query,
            onchange: null,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            addListener: () => undefined,
            removeListener: () => undefined,
            dispatchEvent: () => true,
          } as MediaQueryList;
        }

        return originalMatchMedia(query);
      };
    });
  }
});

test('abre regras de pontuacao pelo botao de icone e mostra criterio de desempate', async ({ page }) => {
  await login(page, 'rules');

  await page.getByRole('button', { name: 'Abrir regras de pontuação' }).first().click();
  await expect(page.getByText('Acertar o Campeão – Critério de Desempate', { exact: true })).toBeVisible();
  await expect(page.getByText(/maior pontuação acumulada nos jogos/)).toBeVisible();
});

test('modal customizado limpa palpites apenas apos confirmacao', async ({ page }) => {
  await login(page, 'clear');

  await page.getByRole('button', { name: /Palpite/ }).first().click();
  const betDialog = page.getByRole('dialog').filter({ hasText: 'Seu Palpite' });
  const homeScore = betDialog.locator('input').nth(0);
  const awayScore = betDialog.locator('input').nth(1);

  await homeScore.fill('03');
  await awayScore.fill('12');
  await expect(homeScore).toHaveValue('3');
  await expect(awayScore).toHaveValue('12');

  await betDialog.getByRole('button', { name: 'Limpar Palpites' }).click();
  await expect(page.getByRole('dialog').filter({ hasText: 'Limpar Palpites' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(homeScore).toHaveValue('3');
  await expect(awayScore).toHaveValue('12');

  await betDialog.getByRole('button', { name: 'Limpar Palpites' }).click();
  await page.getByRole('button', { name: 'Limpar Palpites' }).last().click();
  await expect(homeScore).toHaveValue('');
  await expect(awayScore).toHaveValue('');
  await expect(page.getByText('Palpites removidos com sucesso.')).toBeVisible();
});

test('cards de icone das regras permanecem responsivos em pwa mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'pwa-standalone', 'Atalhos em card circular existem apenas no layout mobile/PWA.');
  await login(page, 'responsive');

  const rulesButton = page.getByRole('button', { name: 'Abrir regras de pontuação' }).first();
  const prizeButton = page.getByRole('button', { name: 'Abrir regras de premiação' }).first();

  await expect(rulesButton).toBeVisible();
  await expect(prizeButton).toBeVisible();

  for (const button of [rulesButton, prizeButton]) {
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(40);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
});
