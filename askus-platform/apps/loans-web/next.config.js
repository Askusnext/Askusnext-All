/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  transpilePackages: ['@askus/api-client', '@askus/authentication', '@askus/shared-types'],
  eslint: { ignoreDuringBuilds: true },
};
