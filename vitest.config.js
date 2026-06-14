import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js', 'src/tests/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['electron/**/*.js'],
      exclude: ['test/**/*.test.js', 'electron/**/dbService.js'],
    },
  },
});
