import { test } from '@playwright/test';
import * as path from 'path';

test.describe('Capture HorusAgent-AI High-Resolution Showcase', () => {
  test.setTimeout(90000);

  const screenshotsDir = '/Applications/XAMPP/xamppfiles/htdocs/AtlasLogix/HorusAgent-AI/docs/screenshots';

  test('Capture all platform showcase screenshots', async ({ page }) => {
    // 1. Set Desktop Viewport
    await page.setViewportSize({ width: 1440, height: 900 });

    // 2. Open Platform
    await page.goto('http://localhost:8888', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // 01: Platform Overview
    await page.screenshot({
      path: path.join(screenshotsDir, '01-horus-platform-overview.png'),
      fullPage: false,
    });

    // 3. Trigger Mission Execution
    const launchBtn = page.getByRole('button', { name: /Launch Swarm Mission/i });
    if (await launchBtn.isVisible()) {
      await launchBtn.click();
    }

    // Wait for streaming to activate
    await page.waitForTimeout(1800);

    // 02: Live Swarm Execution & DAG Transitions
    await page.screenshot({
      path: path.join(screenshotsDir, '02-live-swarm-execution.png'),
      fullPage: false,
    });

    // Wait for mission to complete (takes ~4-5 seconds)
    await page.waitForTimeout(5500);

    // 03: Final Sealed Deliverable
    const deliverableTab = page.getByRole('button', { name: /Sealed Deliverable/i });
    if (await deliverableTab.isVisible()) {
      await deliverableTab.click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(screenshotsDir, '03-sealed-deliverable-audit.png'),
        fullPage: false,
      });
    }

    // 04: Critic Audit Report
    const criticTab = page.getByRole('button', { name: /Critic Audit/i });
    if (await criticTab.isVisible()) {
      await criticTab.click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(screenshotsDir, '04-critic-anti-hallucination.png'),
        fullPage: false,
      });
    }

    // 05: Vector RAG Knowledge Explorer
    const ragBtn = page.getByRole('button', { name: /Vector RAG/i });
    if (await ragBtn.isVisible()) {
      await ragBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({
        path: path.join(screenshotsDir, '05-vector-rag-explorer.png'),
        fullPage: false,
      });

      // Close RAG modal by clicking the X button
      const closeBtn = page.locator('button:has(svg.lucide-x)').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(600);
      }
    }

    // 06: AI Models & API Keys Control Panel
    const aiBtn = page.getByRole('button', { name: /AI Models/i });
    if (await aiBtn.isVisible()) {
      await aiBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: path.join(screenshotsDir, '06-ai-models-control-panel.png'),
        fullPage: false,
      });

      // 07: Swarm Routing Tab
      const routingTab = page.getByRole('button', { name: /Swarm Routing/i });
      if (await routingTab.isVisible()) {
        await routingTab.click();
        await page.waitForTimeout(500);
        await page.screenshot({
          path: path.join(screenshotsDir, '07-ai-swarm-routing-matrix.png'),
          fullPage: false,
        });
      }

      // 08: Presets & Hyperparameters Tab
      const presetsTab = page.getByRole('button', { name: /Presets & Parameters/i });
      if (await presetsTab.isVisible()) {
        await presetsTab.click();
        await page.waitForTimeout(500);
        await page.screenshot({
          path: path.join(screenshotsDir, '08-ai-presets-hyperparameters.png'),
          fullPage: false,
        });
      }

      // 09: Token & Cost Analytics Meter Tab
      const costTab = page.getByRole('button', { name: /Token & Cost Meter/i });
      if (await costTab.isVisible()) {
        await costTab.click();
        await page.waitForTimeout(500);
        await page.screenshot({
          path: path.join(screenshotsDir, '09-ai-token-cost-analytics.png'),
          fullPage: false,
        });
      }
    }
  });
});
