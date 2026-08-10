import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas E2E de navegador (FASE 15).
 *
 * A diferencia de `supabase/tests/*.mjs` —que verifican la API contra un
 * PostgreSQL efimero sin Supabase— estas pruebas necesitan una sesion de
 * Supabase Auth real, asi que corren contra un entorno desplegado
 * (`BASE_URL`), no contra este repositorio en aislamiento. Sin `BASE_URL`
 * configurado, `e2e/smoke.spec.ts` se salta explicitamente en vez de
 * fallar en rojo por un entorno que no le corresponde comprobar.
 *
 * Uso:
 *   BASE_URL=https://tu-entorno.vercel.app \
 *   E2E_EMAIL=comercial@padelbusiness.com \
 *   E2E_PASSWORD=Padel2026! \
 *     npx playwright test
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
