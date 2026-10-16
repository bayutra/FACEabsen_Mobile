import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Spinning up a jsdom environment per worker costs several seconds each,
    // and on this machine the default parallel pool starts so many workers that
    // the pool runner times out waiting for them. The suite is small, so run the
    // files one at a time — predictable and still well under a minute.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
