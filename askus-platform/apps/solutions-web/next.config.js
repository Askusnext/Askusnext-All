/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  webpack: (config) => {
    // Match Vite's behaviour: image imports resolve to a plain URL string
    // instead of Next's StaticImageData object.
    const imageRule = config.module.rules.find(
      (rule) => rule.test && rule.test.toString().includes('svg|png|jpg|jpeg'),
    );
    if (imageRule) imageRule.exclude = /\.(png|jpe?g|webp|avif|gif|svg)$/i;

    config.module.rules.push({
      test: /\.(png|jpe?g|webp|avif|gif|svg)$/i,
      type: 'asset/resource',
    });
    return config;
  },
};

module.exports = nextConfig;
