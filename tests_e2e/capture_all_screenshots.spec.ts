import { test, expect } from '@playwright/test';
import * as path from 'path';

test.describe('AtlasLogix Showcase Screenshots Generator', () => {
  const screenshotsDir = path.resolve(__dirname, '..', 'docs', 'screenshots');

  test('Capture all 8 high-resolution platform showcase screenshots', async ({ page }) => {
    test.setTimeout(90000);
    // Set high-DPI desktop viewport for crisp screenshots
    await page.setViewportSize({ width: 1440, height: 900 });

    // 1. Login Page
    console.log('Capturing 01-login.png...');
    await page.goto('/login');
    await expect(page.locator('#email-input')).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(screenshotsDir, '01-login.png'), fullPage: false });

    // 2. Perform Login as Tenant Administrator
    console.log('Logging in as Tenant Admin...');
    await page.fill('#email-input', 'admin.reda-hafez@atlaslogix.test');
    await page.fill('#password-input', '7P1OhjscS32sQjYWFCra2w');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/shipments');
    await expect(page.getByRole('heading', { name: 'Shipments' })).toBeVisible();

    // 3. Operations Dashboard / Overview Page
    console.log('Capturing 02-dashboard-overview.png...');
    await page.goto('/overview');
    await expect(page.getByText('Compliance command center')).toBeVisible();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(screenshotsDir, '02-dashboard-overview.png'), fullPage: false });

    // 4. Shipments Directory
    console.log('Capturing 03-shipments-directory.png...');
    await page.goto('/shipments');
    await expect(page.getByRole('heading', { name: 'Shipments' })).toBeVisible();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotsDir, '03-shipments-directory.png'), fullPage: false });

    // 5. Shipment Detail Drawer with Excursion History & Audit Trail
    console.log('Capturing 04-shipment-detail-audit.png...');
    const targetRow = page.locator('tr').filter({ hasText: 'ALX-20481' }).first();
    await expect(targetRow).toBeVisible();
    await targetRow.click();
    await expect(page.getByText('Environmental thresholds')).toBeVisible();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotsDir, '04-shipment-detail-audit.png'), fullPage: false });

    // 6. Live Sensors & Telemetry Simulator Page
    console.log('Capturing 05-live-telemetry-simulator.png...');
    await page.goto('/sensors');
    await expect(page.getByText('Live sensors & Simulator')).toBeVisible();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(screenshotsDir, '05-live-telemetry-simulator.png'), fullPage: false });

    // 7. User Administration & Access Governance
    console.log('Capturing 06-user-administration.png...');
    await page.goto('/administration');
    await expect(page.getByText('User & Access Management')).toBeVisible();
    await expect(page.locator('tr').filter({ hasText: 'admin.reda-hafez' })).toBeVisible();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(screenshotsDir, '06-user-administration.png'), fullPage: false });

    // 8. Invite User Modal
    console.log('Capturing 07-invite-user-modal.png...');
    const inviteBtn = page.getByRole('button', { name: /Invite tenant user/i });
    await expect(inviteBtn).toBeVisible();
    await inviteBtn.click();
    await expect(page.getByRole('heading', { name: 'Invite Tenant User' })).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(screenshotsDir, '07-invite-user-modal.png'), fullPage: false });

    // Close modal
    const closeBtn = page.locator('button', { hasText: /Cancel/i });
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(400);
    }

    // 9. Interactive OpenAPI Swagger Documentation
    console.log('Capturing 08-api-swagger-docs.png...');
    await page.goto('/api/docs/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#swagger-ui')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(screenshotsDir, '08-api-swagger-docs.png'), fullPage: false });

    console.log('All 8 showcase screenshots captured with verified rendering!');
  });
});
