import { defineConfig } from 'vitest/config';

// Frontend unit/component tests. Kept out of src so the Next.js build never bundles them.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
    setupFiles: ['test/setup.ts'],
    css: false,
  },
});
