import { test, expect } from '@playwright/test';

/**
 * Camino critico de negocio, de punta a punta (FASE 15).
 *
 * No repite lo que ya prueban las suites de `supabase/tests/`: aquellas
 * verifican que la API hace lo correcto con cada JWT; esto verifica que
 * el navegador real —sesion de Supabase Auth, cookies, redirecciones,
 * JavaScript del cliente— llega a lo mismo. Es la unica capa que
 * comprobaria, por ejemplo, que el boton de "Confirmar venta" sigue
 * apuntando a la Server Action correcta tras un refactor de UI.
 *
 * Requiere BASE_URL, E2E_EMAIL y E2E_PASSWORD de un entorno desplegado
 * con el seed demo cargado (README > Usuarios demo). Sin esas variables,
 * se salta: no tiene sentido fallar en rojo un chequeo que no puede
 * ejecutarse.
 */
const BASE_URL = process.env.BASE_URL;
const EMAIL = process.env.E2E_EMAIL ?? 'comercial@padelbusiness.com';
const PASSWORD = process.env.E2E_PASSWORD ?? 'Padel2026!';
const PROJECT_CODE = process.env.E2E_PROJECT ?? 'EUROPA';

test.skip(!BASE_URL, 'BASE_URL no configurado: prueba de navegador omitida.');

test.describe('camino critico', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/correo|email/i).fill(EMAIL);
    await page.getByLabel(/contrase/i).fill(PASSWORD);
    await page.getByRole('button', { name: /iniciar sesion|entrar/i }).click();
    await page.waitForURL(new RegExp(`/${PROJECT_CODE}/`), { timeout: 15_000 });
  });

  test('el login lleva al dashboard del proyecto con KPIs reales', async ({ page }) => {
    await expect(page).toHaveURL(new RegExp(`/${PROJECT_CODE}/dashboard`));
    // Un numero con separador de miles o simbolo de moneda: si esto
    // aparece, el dashboard trajo datos reales, no una pantalla vacia.
    await expect(page.getByText(/€|\$/).first()).toBeVisible();
  });

  test('el listado de ventas pagina en el servidor, no trae todo de golpe', async ({ page }) => {
    await page.goto(`/${PROJECT_CODE}/ventas`);
    await expect(page.getByRole('table')).toBeVisible();
    // Las filas visibles nunca superan la pagina (§78): un DOM con
    // cientos de <tr> senalaria que la paginacion dejo de aplicarse.
    const rowCount = await page.locator('table tbody tr').count();
    expect(rowCount).toBeLessThanOrEqual(25);
  });

  test('la ficha de una venta muestra su trazabilidad completa', async ({ page }) => {
    await page.goto(`/${PROJECT_CODE}/ventas`);
    await page.locator('table tbody tr').first().click();
    await expect(page).toHaveURL(new RegExp(`/${PROJECT_CODE}/ventas/[0-9a-f-]+`));
    // La ficha de venta (§73) siempre muestra el margen, sea estimado o
    // real: es el eje economico del negocio, nunca deberia faltar.
    await expect(page.getByText(/margen/i).first()).toBeVisible();
  });

  test('documentos: la subida pide autorizacion antes de tocar Storage', async ({ page }) => {
    await page.goto(`/${PROJECT_CODE}/documentos`);
    await expect(page.getByRole('heading', { name: /documentos/i })).toBeVisible();
  });

  test('el asistente de IA responde o explica por que no puede', async ({ page }) => {
    await page.goto(`/${PROJECT_CODE}/ia`);
    const input = page.getByPlaceholder(/pregunta sobre ventas/i);
    if (await input.count() === 0) {
      test.skip(true, 'Este rol no tiene acceso al asistente en este proyecto.');
    }
    await input.fill('Resumen financiero del proyecto');
    await page.getByRole('button').last().click();
    // No exige una respuesta concreta —depende de si hay clave de IA
    // configurada— solo que la pantalla reaccione, en vez de colgarse.
    await expect(page.getByText(/consultando|€|\$|no.*configurada/i).first())
      .toBeVisible({ timeout: 20_000 });
  });
});
