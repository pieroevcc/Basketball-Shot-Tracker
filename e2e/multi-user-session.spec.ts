/**
 * E2E Multi-User Session Test
 *
 * Launches multiple browser contexts to simulate a teacher and
 * multiple students interacting with the app simultaneously.
 *
 * Requires:
 *   - Firebase emulator running with VITE_USE_EMULATOR=true
 *   - Or real Firebase credentials in .env
 *   - Dev server on port 5173 (auto-started by Playwright config)
 */
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import {
  createSessionAsTeacher,
  joinSessionAsStudent,
  advanceAsTeacher,
  recordShot,
} from './fixtures/session-helpers';

test.describe('Multi-user session E2E', () => {
  let teacherCtx: BrowserContext;
  let teacherPage: Page;
  let studentContexts: { ctx: BrowserContext; page: Page; name: string }[];
  let sessionCode: string;

  test.beforeEach(async ({ browser }) => {
    studentContexts = [];

    // Teacher creates session
    teacherCtx = await browser.newContext();
    teacherPage = await teacherCtx.newPage();
    sessionCode = await createSessionAsTeacher(teacherPage);

    // 4 students join
    const studentNames = ['Alice', 'Bob', 'Carol', 'Dave'];
    for (const name of studentNames) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await joinSessionAsStudent(page, sessionCode, name);
      studentContexts.push({ ctx, page, name });
    }
  });

  test.afterEach(async () => {
    for (const { ctx } of studentContexts) {
      await ctx.close();
    }
    await teacherCtx.close();
  });

  test('teacher sees all 4 students in lobby', async () => {
    for (const { name } of studentContexts) {
      await expect(teacherPage.locator(`text=${name}`)).toBeVisible({
        timeout: 10_000,
      });
    }
  });

  test('full session lifecycle with 4 students', async () => {
    // Verify teacher sees all students
    for (const { name } of studentContexts) {
      await expect(teacherPage.locator(`text=${name}`)).toBeVisible({
        timeout: 10_000,
      });
    }

    // Teacher starts solo round
    await advanceAsTeacher(teacherPage, 'Start Solo');

    // Each student sees "Solo Activity" and records a few shots
    for (const { page } of studentContexts) {
      await expect(page.locator('text=Solo Activity')).toBeVisible({
        timeout: 10_000,
      });

      // Record 2 shots per student (faster than full 15)
      for (let i = 0; i < 2; i++) {
        await recordShot(page, i % 2 === 0);
      }
    }

    // Teacher ends solo round
    await advanceAsTeacher(teacherPage, 'End Solo');

    // Students should see solo review
    for (const { page } of studentContexts) {
      await expect(page.locator('text=Your Solo Results')).toBeVisible({
        timeout: 10_000,
      });
    }

    // Teacher pairs teams
    await advanceAsTeacher(teacherPage, 'Pair Teams');

    // Students should see team strategy
    for (const { page } of studentContexts) {
      await expect(page.locator('text=Team Strategy')).toBeVisible({
        timeout: 10_000,
      });
    }

    // Teacher starts team round
    await advanceAsTeacher(teacherPage, 'Start Team');

    // Students record team shots
    for (const { page } of studentContexts) {
      await expect(page.locator('text=Team Activity')).toBeVisible({
        timeout: 10_000,
      });
      await recordShot(page, true);
    }

    // Teacher ends team round
    await advanceAsTeacher(teacherPage, 'End Team');

    // Teacher ends session
    await advanceAsTeacher(teacherPage, 'End Session');

    // Students see ended screen
    for (const { page } of studentContexts) {
      await expect(page.locator('text=Great work today')).toBeVisible({
        timeout: 10_000,
      });
    }
  });
});

test.describe('Edge cases', () => {
  test('duplicate name is rejected', async ({ browser }) => {
    // Teacher creates session
    const teacherCtx = await browser.newContext();
    const teacherPage = await teacherCtx.newPage();
    const code = await createSessionAsTeacher(teacherPage);

    // First student joins
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await joinSessionAsStudent(page1, code, 'SameName');

    // Second student tries same name
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await page2.goto('/');
    await page2.click('button:has-text("Join Session")');

    const codeInput = page2.locator('input[placeholder*="code" i], input[name="code"], input[maxlength="6"]').first();
    await codeInput.fill(code);

    const nameInput = page2.locator('input[placeholder*="name" i], input[name="name"]').first();
    await nameInput.fill('SameName');

    await page2.click('button:has-text("Join")');

    // Should see error about name being taken
    await expect(page2.locator('text=Name taken')).toBeVisible({
      timeout: 10_000,
    });

    await ctx1.close();
    await ctx2.close();
    await teacherCtx.close();
  });
});
