import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    // The auth/employees/devices/users specs hash with real Argon2
    // (m=64MiB, t=3). Under parallel workers that easily overruns the 5s
    // default on a busy machine and produces spurious timeouts, so give these
    // room; serial runs finish the whole suite in well under a minute.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
