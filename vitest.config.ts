import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Minimal smoke-test harness. Pure `lib/` logic only (billing math, schemas) —
// no DB, no network, no React. `server-only` is aliased to a no-op stub so
// modules that guard themselves with `import 'server-only'` can still be unit
// tested in the node environment.
export default defineConfig({
  resolve: {
    alias: {
      'server-only': path.resolve(__dirname, 'test/stubs/server-only.ts'),
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
})
