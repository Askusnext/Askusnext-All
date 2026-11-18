/** Backend tests live in ./test (outside src so `nest build` never ships them). */
module.exports = {
  rootDir: 'test',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json', isolatedModules: true, diagnostics: false }] },
  testEnvironment: 'node',
  testTimeout: 60000,
};
