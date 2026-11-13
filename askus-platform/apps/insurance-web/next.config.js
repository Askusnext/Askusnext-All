/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  transpilePackages: [
    '@askus/api-client',
    '@askus/authentication',
    '@askus/shared-types',
    '@askus/ui-components',
    '@askus/validation',
  ],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Node-only fallbacks some OCR/PDF packages probe for; the browser never needs them.
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, canvas: false };
    }
    return config;
  },
};
