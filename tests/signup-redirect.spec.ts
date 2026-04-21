import { expect, test } from '@playwright/test';
import { buildUniqueCredentials } from './supabase-test-utils';

test('novo usuario finaliza cadastro e volta para a tela de login', async ({ page }) => {
  const credentials = buildUniqueCredentials('signup');

  await page.goto('/');

  await page.getByRole('button', { name: 'Criar Novo Cadastro' }).click();
  await expect(page.getByText('Novo Cadastro', { exact: true })).toBeVisible();

  await page.getByLabel('Nome Completo').fill(credentials.name);
  await page.getByLabel('E-mail').fill(credentials.email);
  await page.getByLabel('Senha').fill(credentials.password);

  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: /Brasil/i }).click();

  await page.getByRole('button', { name: 'Finalizar Cadastro' }).click();

  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Criar Novo Cadastro' })).toBeVisible();
  await expect(page.getByLabel('E-mail')).toBeVisible();
});
