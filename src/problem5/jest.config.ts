import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testEnvironmentOptions: {
    env: { NODE_ENV: 'test' },
  },
  rootDir: '.',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/app/server.ts',
    '!src/**/*.d.ts',
  ],
};

export default config;
