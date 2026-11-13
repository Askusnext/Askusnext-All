/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('@askus/ui-components/tailwind-preset')],
  content: ['./app/**/*.{ts,tsx}', '../../packages/ui-components/src/**/*.{ts,tsx}'],
};
