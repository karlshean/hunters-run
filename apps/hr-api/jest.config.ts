import type {Config} from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  moduleFileExtensions: ['ts','js','json'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  transformIgnorePatterns: ['/node_modules/'],
};

export default config;