import { type Page, expect } from '@playwright/test';

/**
 * Creates a session as a teacher and returns the session code.
 */
export async function createSessionAsTeacher(page: Page): Promise<string> {
  await page.goto('/');

  // Click "Create Session" on landing page
  await page.click('button:has-text("Create Session")');

  // Wait for session code to appear (displayed in large text)
  const codeElement = await page.waitForSelector('.session-code-display, .lobby-code', {
    timeout: 10_000,
  });
  const code = await codeElement.textContent();
  if (!code || code.length < 4) {
    throw new Error(`Invalid session code: ${code}`);
  }

  return code.trim();
}

/**
 * Joins a session as a student with the given code and name.
 */
export async function joinSessionAsStudent(
  page: Page,
  code: string,
  name: string
): Promise<void> {
  await page.goto('/');

  // Click "Join Session" on landing page
  await page.click('button:has-text("Join Session")');

  // Enter session code
  const codeInput = page.locator('input[placeholder*="code" i], input[name="code"], input[maxlength="6"]').first();
  await codeInput.fill(code);

  // Enter name
  const nameInput = page.locator('input[placeholder*="name" i], input[name="name"]').first();
  await nameInput.fill(name);

  // Submit
  await page.click('button:has-text("Join")');

  // Wait for lobby (student sees "Waiting for your teacher")
  await expect(page.locator('text=Waiting for your teacher')).toBeVisible({
    timeout: 10_000,
  });
}

/**
 * Clicks a button on the teacher's page to advance the session.
 */
export async function advanceAsTeacher(page: Page, buttonText: string): Promise<void> {
  await page.click(`button:has-text("${buttonText}")`, { timeout: 10_000 });
}

/**
 * Records a shot by clicking a zone on the basketball court SVG.
 * After clicking the zone, clicks "Made" or "Missed" button.
 */
export async function recordShot(page: Page, made: boolean): Promise<void> {
  // Click on the court SVG (first clickable zone)
  const zone = page.locator('.court-zone, [data-zone]').first();
  await zone.click();

  // Click Made or Missed
  if (made) {
    await page.click('button:has-text("Made")');
  } else {
    await page.click('button:has-text("Missed")');
  }
}
