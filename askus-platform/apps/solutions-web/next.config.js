/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export only for production builds (Cloudflare). In dev, the export
  // check rejects client-side routes like /home on a hard load.
  ...(process.env.NODE_ENV === 'production' ? { output: 'export' } : {}),
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  webpack: (config) => {
    // Match Vite's behaviour: image imports resolve to a plain URL string
    // instead of Next's StaticImageData object.
    // Disable Next's built-in next-image-loader wherever it sits in the rule tree
    // (it otherwise runs too and its JS output gets emitted as the image file).
    const disableImageLoader = (rules) => {
      for (const rule of rules) {
        if (!rule) continue;
        if (rule.loader && String(rule.loader).includes('next-image-loader')) {
          rule.exclude = /\.(png|jpe?g|webp|avif|gif|svg|ico|bmp)$/i;
        }
        if (Array.isArray(rule.oneOf)) disableImageLoader(rule.oneOf);
        if (Array.isArray(rule.rules)) disableImageLoader(rule.rules);
      }
    };
    disableImageLoader(config.module.rules);

    config.module.rules.push({
      test: /\.(png|jpe?g|webp|avif|gif|svg)$/i,
      type: 'asset/resource',
    });
    return config;
  },
};

module.exports = nextConfig;
