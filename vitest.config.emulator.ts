import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup-emulator.ts'],
    include: ['tests/emulator/**/*.test.ts'],
    testTimeout: 30000,
  },
});
