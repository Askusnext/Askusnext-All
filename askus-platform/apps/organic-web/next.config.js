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
};
