/** @type {import('next').NextConfig} */
const apiOrigin = (process.env.API_ORIGIN ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
);

const nextConfig = {
  // Browser calls stay same-origin: /api/v1/* is proxied to the NestJS API.
  // Set API_ORIGIN at build/run time for non-local deployments.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
