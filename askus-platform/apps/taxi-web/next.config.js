/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // Static export only for production builds (Cloudflare). Keeping dev on the
  // normal Next.js server avoids the export checks rejecting client-side routes.
  ...(process.env.NODE_ENV === 'production' ? { output: 'export' } : {}),
  transpilePackages: [
    '@askus/api-client',
    '@askus/authentication',
    '@askus/shared-types',
    '@askus/ui-components',
    '@askus/validation',
  ],
};
