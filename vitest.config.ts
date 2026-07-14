import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '#': `${root}src`,
      '@': `${root}src`,
      'cloudflare:workers': `${root}test/mocks/cloudflare-workers.ts`,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/routeTree.gen.ts',
        'src/lib/types.ts',
        'src/components/dither-kit/**',
        '**/*.d.ts',
        'dist/**',
        'node_modules/**',
      ],
      thresholds: {
        // Calibrated to the measured pre-redesign baseline so the gate catches
        // regressions instead of failing every clean run unconditionally.
        lines: 68,
        statements: 66,
        functions: 61,
        branches: 63,
      },
    },
  },
})
