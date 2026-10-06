import { test, expect } from '@playwright/test';

test.describe('Caregiver Flow: Signup → Forced Profile Setup → Live Tracking Map', () => {
  const timestamp = Date.now();
  const caregiverName = `Aarav Mehta ${timestamp.toString().slice(-4)}`;
  const caregiverEmail = `caregiver_${timestamp}@testdomain.internal`;
  const caregiverPassword = 'Password123!';
  const caregiverPhone = '9876543210';

  test('New caregiver signup enforces profile setup, saves profile, displays real name on live map, and skips setup on re-login', async ({ page }) => {
    // 1. Visit signup page
    await page.goto('/signup');
    await expect(page).toHaveURL(/.*signup/);

    // 2. Select Caregiver role
    const caregiverRoleBtn = page.getByRole('button', { name: /Parent \/ Caregiver/i });
    await caregiverRoleBtn.click();

    // 3. Fill signup form
    await page.fill('#signup-name', caregiverName);
    await page.fill('#signup-email', caregiverEmail);
    await page.fill('#signup-password', caregiverPassword);
    await page.click('button:has-text("Continue to Profile Setup")');

    // 4. Verification: Forced redirect to /caregiver/profile-setup
    await page.waitForURL('**/caregiver/profile-setup', { timeout: 15000 });
    expect(page.url()).toContain('/caregiver/profile-setup');

    // Verify uncompleted caregiver cannot navigate away to other caregiver pages
    await page.goto('/caregiver/map');
    await page.waitForURL('**/caregiver/profile-setup', { timeout: 10000 });
    expect(page.url()).toContain('/caregiver/profile-setup');

    // 5. Fill Profile Setup
    // Step 1: Personal Details
    const nameInput = page.locator('#caregiver-name');
    await expect(nameInput).toBeVisible();
    if ((await nameInput.inputValue()) !== caregiverName) {
      await nameInput.fill(caregiverName);
    }
    await page.fill('#caregiver-phone', caregiverPhone);
    await page.click('#caregiver-next-btn');

    // Step 2: Role & Language
    await expect(page.getByText('Relationship & Language')).toBeVisible();
    await page.click('#rel-choice-guardian');
    await page.click('#caregiver-next-btn');

    // Step 3: Alert Channels & Review
    await expect(page.getByText('Emergency Alert Channels')).toBeVisible();
    const submitBtn = page.locator('#submit-caregiver-profile');
    await submitBtn.click();

    // 6. Lands on /caregiver/map
    await page.waitForURL('**/caregiver/map', { timeout: 20000 });
    expect(page.url()).toContain('/caregiver/map');

    // 7. Verify real name and role in sidebar footer
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByText(caregiverName)).toBeVisible({ timeout: 10000 });
    await expect(sidebar.getByText(/Legal Guardian|Parent \/ Caregiver/i)).toBeVisible();

    // 8. Verify empty state UI requirements on Live Tracking Map
    // With "No Dependent Selected", Following, Trail On, Manage buttons are hidden
    await expect(page.getByRole('button', { name: 'Following' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Trail On' })).not.toBeVisible();
    // Navigation banner 60 m should not be visible
    await expect(page.getByText('steps ahead')).not.toBeVisible();
    // Main content shows empty-state card
    await expect(page.getByText('No dependents linked yet')).toBeVisible();
    await expect(page.getByRole('link', { name: /Add Dependent With Pairing Code/i })).toBeVisible();

    // 9. Test logging out
    const logoutBtn = sidebar.locator('button[aria-label="Log out of Caregiver Portal"]');
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();

    // Lands on /login
    await page.waitForURL('**/login', { timeout: 15000 });
    expect(page.url()).toContain('/login');

    // 10. Log back in as returning caregiver
    const caregiverPortalTab = page.getByText('I am a Parent / Caregiver');
    await caregiverPortalTab.click();
    await page.fill('input[type="email"]', caregiverEmail);
    await page.fill('input[type="password"]', caregiverPassword);
    await page.click('button[type="submit"]:has-text("Enter Caregiver Portal")');

    // 11. Verification: Skips profile setup and goes straight to /caregiver/map!
    await page.waitForURL('**/caregiver/map', { timeout: 15000 });
    expect(page.url()).toContain('/caregiver/map');
    await expect(sidebar.getByText(caregiverName)).toBeVisible();

    // If returning caregiver attempts to visit /caregiver/profile-setup directly without ?edit=true, redirected to /caregiver/map
    await page.goto('/caregiver/profile-setup');
    await page.waitForURL('**/caregiver/map', { timeout: 10000 });
    expect(page.url()).toContain('/caregiver/map');
  });
});
