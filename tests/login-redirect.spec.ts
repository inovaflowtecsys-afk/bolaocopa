import { expect, test } from '@playwright/test';
import { createUserThroughApi } from './supabase-test-utils';

test('usuario existente faz login e entra no dashboard', async ({ page }) => {
  const credentials = await createUserThroughApi('login');

  await page.goto('/');

  await page.getByLabel('E-mail').fill(credentials.email);
  await page.getByLabel('Senha').fill(credentials.password);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page.getByText('Grupo oficial no WhatsApp')).toBeVisible();
  await expect(page.getByText('Jogos', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(credentials.name).first()).toBeVisible();
});
