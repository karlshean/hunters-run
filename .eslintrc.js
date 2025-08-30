module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
  ],
  env: {
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  rules: {
    // Security-focused rules
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    '@typescript-eslint/no-explicit-any': 'warn', // Warn instead of error for gradual typing
    
    // Code quality rules
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off', // Allow type inference
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-inferrable-types': 'off',
    
    // NestJS specific adjustments
    '@typescript-eslint/no-empty-function': 'off', // Common in NestJS decorators
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-member-accessibility': 'off',
    
    // Import/export rules
    'no-duplicate-imports': 'error',
    
    // General code style (handled by Prettier)
    'indent': 'off',
    'quotes': 'off',
    'semi': 'off',
  },
  overrides: [
    {
      // Test files can be more lenient
      files: ['**/*.test.ts', '**/*.spec.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
      },
    },
    {
      // Configuration files
      files: ['*.config.js', '*.config.ts', 'webpack.config.js'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
    {
      // Database migration and seed files
      files: ['**/migrations/**/*.ts', '**/seeds/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
      },
    },
  ],
  ignorePatterns: [
    'dist/',
    'node_modules/',
    'coverage/',
    '*.js', // Ignore compiled JS files
    '.eslintrc.js', // Ignore this file itself
    '.lintstagedrc.js',
  ],
};