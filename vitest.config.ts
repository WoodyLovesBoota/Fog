import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Vitest needs the same `@/* -> ./src/*` path alias that tsconfig + metro use,
 * otherwise tests that exercise modules importing via `@/...` can't resolve them.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
