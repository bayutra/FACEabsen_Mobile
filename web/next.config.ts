import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // STEP 25: self-contained production image (see web/Dockerfile).
  output: 'standalone',
  // Required for `forbidden()` / `forbidden.tsx` (auth interrupts).
  experimental: {
    authInterrupts: true,
  },
};

export default nextConfig;
