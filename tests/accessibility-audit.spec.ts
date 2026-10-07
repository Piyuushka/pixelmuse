import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('WCAG 2.2 AA Accessibility Audits', () => {
  test('Audit /login page for WCAG AA violations', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    const criticalOrSerious = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    if (criticalOrSerious.length > 0) {
      console.log('Violations on /login:', JSON.stringify(criticalOrSerious, null, 2));
    }

    expect(criticalOrSerious).toEqual([]);
  });

  test('Audit /user/map page for WCAG AA violations', async ({ page }) => {
    // Authenticate
    await page.goto('/login');
    await page.getByText('I am a User (Dependent)').click();
    await page.locator('input[type="email"]').fill('alex.rivera@community.org');
    await page.locator('input[type="password"]').fill('password123');
    await page.getByRole('button', { name: /Enter User Portal/i }).click();
    await page.waitForURL(url => url.pathname.includes('/user'), { timeout: 15000 });

    await page.goto('/user/map');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    const criticalOrSerious = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    if (criticalOrSerious.length > 0) {
      console.log('Violations on /user/map:', JSON.stringify(criticalOrSerious, null, 2));
    }

    expect(criticalOrSerious).toEqual([]);
  });

  test('Audit /user/community page for WCAG AA violations', async ({ page }) => {
    // Authenticate
    await page.goto('/login');
    await page.getByText('I am a User (Dependent)').click();
    await page.locator('input[type="email"]').fill('alex.rivera@community.org');
    await page.locator('input[type="password"]').fill('password123');
    await page.getByRole('button', { name: /Enter User Portal/i }).click();
    await page.waitForURL(url => url.pathname.includes('/user'), { timeout: 15000 });

    await page.goto('/user/community');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    const criticalOrSerious = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    if (criticalOrSerious.length > 0) {
      console.log('Violations on /user/community:', JSON.stringify(criticalOrSerious, null, 2));
    }

    expect(criticalOrSerious).toEqual([]);
  });

  test('Audit /user/profile page for WCAG AA violations', async ({ page }) => {
    // Authenticate
    await page.goto('/login');
    await page.getByText('I am a User (Dependent)').click();
    await page.locator('input[type="email"]').fill('alex.rivera@community.org');
    await page.locator('input[type="password"]').fill('password123');
    await page.getByRole('button', { name: /Enter User Portal/i }).click();
    await page.waitForURL(url => url.pathname.includes('/user'), { timeout: 15000 });

    await page.goto('/user/profile');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    const criticalOrSerious = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    if (criticalOrSerious.length > 0) {
      console.log('Violations on /user/profile:', JSON.stringify(criticalOrSerious, null, 2));
    }

    expect(criticalOrSerious).toEqual([]);
  });
});
