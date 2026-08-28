import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('AtlasLogix Full-Stack E2E & Accessibility Assessment Suite', () => {

  test('Complete flow: Login -> Shipment Directory -> Shipment Detail -> Compliance Approval', async ({ page }) => {
    // 1. Visit Login Page
    await page.goto('/login');
    await expect(page).toHaveTitle(/AtlasLogix/);

    // Verify brand heading & persistent form controls
    await expect(page.locator('h1').first()).toContainText('Atlas');
    await expect(page.locator('#email-input')).toBeVisible();
    await expect(page.locator('#password-input')).toBeVisible();

    // 2. Perform Login with Auditor Seed Account
    await page.fill('#email-input', 'auditor.reda-hafez@atlaslogix.test');
    await page.fill('#password-input', '4wLJerbLyBGBGZG8t8IIjA');
    await page.click('button[type="submit"]');

    // 3. Verify Redirect to Shipments Directory
    await page.waitForURL('/shipments');
    await expect(page.getByRole('heading', { name: 'Shipments' })).toBeVisible();

    // Verify tenant scope indicator
    await expect(page.getByText('TENANT', { exact: false })).toBeVisible();

    // 4. Filter Shipments and Click ALX-20481
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('ALX-20481');

    const shipmentRow = page.locator('tr').filter({ hasText: 'ALX-20481' });
    await expect(shipmentRow).toBeVisible();

    // Click shipment row to open review drawer
    await shipmentRow.click();

    // 5. Verify Shipment Detail & Telemetry Components in Drawer
    await expect(page.getByText('ALX-20481').first()).toBeVisible();
    await expect(page.getByText('Environmental thresholds')).toBeVisible();

    // Switch to Compliance Tab inside Drawer
    await page.locator('button', { hasText: /^compliance$/i }).click();
    await expect(page.getByText('Auditor decision required')).toBeVisible();

    // 6. Test Auditor Approval Modal Flow
    const approveBtn = page.getByRole('button', { name: /Approve compliance/i });
    if (await approveBtn.count() > 0 && await approveBtn.isVisible()) {
      await approveBtn.click();

      // Modal verification
      await expect(page.locator('#modal-title')).toContainText('Approve Compliance');

      // Enter rationale
      const reasonInput = page.locator('#approval-reason');
      await reasonInput.fill('Temperature excursion reviewed and accepted by chief auditor.');

      const confirmBtn = page.getByRole('button', { name: /Confirm Approval/i });
      await confirmBtn.click();

      // Verify success status update
      await expect(page.getByText('Compliance Approved')).toBeVisible();
    } else {
      // Record was already approved in previous run
      await expect(page.getByText('Compliance Approved')).toBeVisible();
    }
  });

  test('Automated Accessibility Check (WCAG 2.1 AA) on Core Page', async ({ page }) => {
    await page.goto('/login');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

});
