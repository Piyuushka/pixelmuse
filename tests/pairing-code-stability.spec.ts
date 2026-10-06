import { test, expect } from '@playwright/test';

test.describe('Pairing Code Stability & Lifecycle', () => {
  test('Pairing code does not change on polling, survives refresh, and regenerates only on click', async ({ page }) => {
    // 1. Log in with existing onboarded user
    await page.goto('/login');
    await page.getByText('I am a User (Dependent)').click();

    await page.locator('input[type="email"]').fill('alex.rivera@community.org');
    await page.locator('input[type="password"]').fill('password123');
    await page.getByRole('button', { name: /Enter User Portal/i }).click();

    // 2. Wait for landing on /user/map or redirect to /user/share
    await page.waitForURL(url => url.pathname.includes('/user'), { timeout: 15000 });

    // 3. Navigate to /user/share
    await page.goto('/user/share');
    await page.waitForLoadState('networkidle');

    // Wait for the 6-digit code to appear (formatted e.g. "789-840" or "789840")
    const codeElement = page.locator('span.select-all');
    await expect(codeElement).toBeVisible({ timeout: 15000 });

    const initialCode = (await codeElement.textContent())?.trim();
    expect(initialCode).toBeTruthy();
    const rawDigits = initialCode?.replace(/\D/g, '');
    expect(rawDigits?.length).toBe(6);

    // 4. Wait 12 seconds to verify code stability across multiple 4-second polling intervals
    await page.waitForTimeout(12000);
    const codeAfterPolling = (await codeElement.textContent())?.trim();
    expect(codeAfterPolling).toBe(initialCode);

    // 5. Refresh page and verify the same code survives
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(codeElement).toBeVisible({ timeout: 10000 });

    const codeAfterRefresh = (await codeElement.textContent())?.trim();
    expect(codeAfterRefresh).toBe(initialCode);

    // 6. Click "Regenerate New Code" and verify a fresh code is generated
    const regenerateBtn = page.getByRole('button', { name: /Regenerate New Code/i });
    await regenerateBtn.click();

    await page.waitForTimeout(1500);
    const regeneratedCode = (await codeElement.textContent())?.trim();
    expect(regeneratedCode).toBeTruthy();
    expect(regeneratedCode?.replace(/\D/g, '')?.length).toBe(6);
    expect(regeneratedCode).not.toBe(initialCode);
  });
});
