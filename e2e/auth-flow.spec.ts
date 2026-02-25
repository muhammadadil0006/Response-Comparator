import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Sign In')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('should navigate to register page from login', async ({ page }) => {
    await page.goto('/login');
    await page.click('text=Create an account');
    await expect(page).toHaveURL('/register');
  });

  test('should display register page', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByText('Create Account')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('should show validation error for invalid email', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'invalid-email');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    // Should show error feedback
    await expect(page.locator('.text-red-600, .text-red-500')).toBeVisible();
  });

  test('should redirect unauthenticated users from history', async ({
    page,
  }) => {
    await page.goto('/history');
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should allow access to compare page without auth', async ({
    page,
  }) => {
    await page.goto('/compare');
    await expect(page).toHaveURL('/compare');
    await expect(
      page.getByPlaceholder(/enter your prompt/i)
    ).toBeVisible();
  });

  test('should display home page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('AI Model Playground')).toBeVisible();
    await expect(page.getByText('Compare AI Models')).toBeVisible();
  });
});

test.describe('Comparison Flow', () => {
  test('should show model panels on compare page', async ({ page }) => {
    await page.goto('/compare');
    await expect(page.getByText('GPT-4o')).toBeVisible();
    await expect(page.getByText('Claude 3 Sonnet')).toBeVisible();
    await expect(page.getByText('Grok 2')).toBeVisible();
  });

  test('should have a prompt input area', async ({ page }) => {
    await page.goto('/compare');
    const textarea = page.getByPlaceholder(/enter your prompt/i);
    await expect(textarea).toBeVisible();
    await textarea.fill('What is artificial intelligence?');
    await expect(textarea).toHaveValue('What is artificial intelligence?');
  });
});
