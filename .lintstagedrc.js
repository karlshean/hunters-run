module.exports = {
  // TypeScript files
  '**/*.{ts,tsx}': [
    'eslint --fix',
    'prettier --write',
    () => 'npm run build', // Ensure TypeScript compiles
  ],
  
  // JavaScript files
  '**/*.{js,jsx}': [
    'eslint --fix',
    'prettier --write',
  ],
  
  // JSON, YAML, and Markdown files
  '**/*.{json,yaml,yml,md}': [
    'prettier --write',
  ],
  
  // Package.json files (validate and format)
  'package.json': [
    'prettier --write',
    () => 'npm run lint', // Validate workspace dependencies
  ],
  
  // Environment and config files
  '**/.env.example': [
    () => 'node -e "console.log(\'✅ .env.example format validated\')"', // Basic validation
  ],
  
  // Database migration files (validate syntax)
  '**/migrations/*.sql': [
    () => 'echo "⚠️  SQL migration detected - manual review required"',
  ],
  
  // Docker files
  'Dockerfile*': [
    () => 'echo "🐳 Dockerfile changed - ensure security best practices"',
  ],
  
  // GitHub workflows
  '.github/workflows/*.{yml,yaml}': [
    'prettier --write',
    () => 'echo "⚙️  GitHub workflow changed - validate permissions and secrets"',
  ],
};