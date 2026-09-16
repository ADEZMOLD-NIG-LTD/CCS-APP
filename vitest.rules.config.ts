import { defineConfig } from 'vitest/config';

// Runs against the Firestore emulator: `npm run test:rules` (requires Java 21+).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
