import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['electron/**/*.js'],
      exclude: ['test/**/*.test.js', 'electron/**/dbService.js'],
    },
    // `environmentMatchGlobs` was removed in Vitest 4; per-environment test
    // execution now goes through `projects` instead. Node-only tests
    // (electron/database logic, plain services) stay fast under 'node',
    // while component tests that touch `document`/DOM APIs run under 'jsdom'.
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['test/**/*.test.js', 'src/tests/**/*.test.js'],
        },
      },
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['src/tests/**/*.test.jsx'],
        },
      },
    ],
  },
});
