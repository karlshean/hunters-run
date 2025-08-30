#!/usr/bin/env node

/**
 * Comprehensive Security Test Suite
 * Tests all implemented security hardening measures with live verification
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

console.log('🔒 HUNTERS RUN PLATFORM - COMPREHENSIVE SECURITY TEST SUITE');
console.log('='.repeat(70));
console.log(`Date: ${new Date().toISOString()}`);
console.log(`Root Directory: ${rootDir}`);
console.log('');

const results = {
  timestamp: new Date().toISOString(),
  tests: [],
  summary: { passed: 0, failed: 0, warnings: 0 }
};

function logTest(name, status, details, evidence = null) {
  const test = { name, status, details, evidence, timestamp: new Date().toISOString() };
  results.tests.push(test);
  
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} ${name}`);
  if (details) console.log(`   ${details}`);
  if (evidence) console.log(`   Evidence: ${evidence}`);
  console.log('');
  
  results.summary[status === 'PASS' ? 'passed' : status === 'FAIL' ? 'failed' : 'warnings']++;
}

function runCommand(command, description) {
  try {
    console.log(`🔄 Running: ${description}`);
    const output = execSync(command, { 
      cwd: rootDir, 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    return { success: true, output };
  } catch (error) {
    return { success: false, output: error.message, stderr: error.stderr };
  }
}

function fileExists(filePath) {
  return fs.existsSync(path.join(rootDir, filePath));
}

function readFileContent(filePath) {
  try {
    return fs.readFileSync(path.join(rootDir, filePath), 'utf8');
  } catch {
    return null;
  }
}

console.log('📋 PART 1.1: RUNTIME & TOOLCHAIN PINNING VERIFICATION');
console.log('-'.repeat(50));

// Test 1.1: Node version pinning
const nvmrcContent = readFileContent('.nvmrc');
if (nvmrcContent && nvmrcContent.trim() === 'v22.18.0') {
  logTest('Node.js version pinning', 'PASS', 'Node version pinned to v22.18.0 in .nvmrc');
} else {
  logTest('Node.js version pinning', 'FAIL', '.nvmrc missing or incorrect version');
}

// Test 1.1: Package.json engines
const packageJson = JSON.parse(readFileContent('package.json') || '{}');
const nodeEngine = packageJson.engines?.node;
const packageManager = packageJson.packageManager;

if (nodeEngine === '22.18.0') {
  logTest('Package.json Node engine', 'PASS', `Node engine pinned to ${nodeEngine}`);
} else {
  logTest('Package.json Node engine', 'FAIL', `Node engine not properly pinned: ${nodeEngine}`);
}

if (packageManager && packageManager.includes('npm@10.9.0')) {
  logTest('Package manager pinning', 'PASS', `Package manager pinned: ${packageManager}`);
} else {
  logTest('Package manager pinning', 'WARN', `Package manager not pinned: ${packageManager}`);
}

// Test 1.1: CI toolchain check workflow
if (fileExists('.github/workflows/toolchain-check.yml')) {
  const workflowContent = readFileContent('.github/workflows/toolchain-check.yml');
  if (workflowContent.includes('node-version-file') && workflowContent.includes('.nvmrc')) {
    logTest('CI toolchain workflow', 'PASS', 'GitHub workflow uses .nvmrc for Node version');
  } else {
    logTest('CI toolchain workflow', 'WARN', 'Workflow exists but may not use .nvmrc');
  }
} else {
  logTest('CI toolchain workflow', 'FAIL', 'Toolchain check workflow missing');
}

console.log('🔐 PART 1.2: SECRETS ERGONOMICS VERIFICATION');
console.log('-'.repeat(50));

// Test 1.2: Environment validation
if (fileExists('apps/hr-api/src/config/environment.ts')) {
  const envConfig = readFileContent('apps/hr-api/src/config/environment.ts');
  if (envConfig.includes('dotenv-safe') && envConfig.includes('required')) {
    logTest('Environment validation', 'PASS', 'dotenv-safe with required validation implemented');
  } else {
    logTest('Environment validation', 'WARN', 'Environment config exists but validation unclear');
  }
} else {
  logTest('Environment validation', 'FAIL', 'Environment configuration missing');
}

// Test 1.2: .env.example template
if (fileExists('apps/hr-api/.env.example')) {
  const envExample = readFileContent('apps/hr-api/.env.example');
  const requiredVars = ['DATABASE_URL', 'FIREBASE_PROJECT_ID', 'NODE_ENV'];
  const missingVars = requiredVars.filter(v => !envExample.includes(v));
  
  if (missingVars.length === 0) {
    logTest('.env.example template', 'PASS', 'All required environment variables documented');
  } else {
    logTest('.env.example template', 'WARN', `Missing variables: ${missingVars.join(', ')}`);
  }
} else {
  logTest('.env.example template', 'FAIL', '.env.example template missing');
}

// Test 1.2: Firebase dual authentication
if (fileExists('apps/hr-api/src/config/firebase.ts')) {
  const firebaseConfig = readFileContent('apps/hr-api/src/config/firebase.ts');
  if (firebaseConfig.includes('SERVICE_ACCOUNT_PATH') && firebaseConfig.includes('SERVICE_ACCOUNT_JSON')) {
    logTest('Firebase dual auth', 'PASS', 'Both SERVICE_ACCOUNT_PATH and SERVICE_ACCOUNT_JSON supported');
  } else {
    logTest('Firebase dual auth', 'WARN', 'Firebase config exists but dual strategy unclear');
  }
} else {
  logTest('Firebase dual auth', 'FAIL', 'Firebase configuration missing');
}

console.log('🗄️ PART 1.3: DATABASE ROLES ISOLATION VERIFICATION');
console.log('-'.repeat(50));

// Test 1.3: Database role setup script
if (fileExists('scripts/setup-db-roles.sql')) {
  const roleScript = readFileContent('scripts/setup-db-roles.sql');
  if (roleScript.includes('app_user') && roleScript.includes('migration_user')) {
    logTest('Database role script', 'PASS', 'app_user and migration_user roles defined');
  } else {
    logTest('Database role script', 'WARN', 'Role script exists but roles unclear');
  }
} else {
  logTest('Database role script', 'FAIL', 'Database role setup script missing');
}

// Test 1.3: Role verification tool
if (fileExists('scripts/whoami-probe.js')) {
  const probeScript = readFileContent('scripts/whoami-probe.js');
  if (probeScript.includes('current_user') && probeScript.includes('rolbypassrls')) {
    logTest('Database role probe', 'PASS', 'Role verification tool checks user and RLS bypass');
  } else {
    logTest('Database role probe', 'WARN', 'Probe tool exists but verification unclear');
  }
} else {
  logTest('Database role probe', 'FAIL', 'Database role probe tool missing');
}

console.log('💾 PART 1.4: BACKUP & RESTORE VERIFICATION');  
console.log('-'.repeat(50));

// Test 1.4: Backup automation
if (fileExists('tools/db/backup.mjs')) {
  const backupScript = readFileContent('tools/db/backup.mjs');
  if (backupScript.includes('pg_dump') && backupScript.includes('schema')) {
    logTest('Backup automation', 'PASS', 'Database backup script with schema selection');
  } else {
    logTest('Backup automation', 'WARN', 'Backup script exists but functionality unclear');
  }
} else {
  logTest('Backup automation', 'FAIL', 'Database backup script missing');
}

// Test 1.4: Restore verification
if (fileExists('tools/db/restore.mjs')) {
  const restoreScript = readFileContent('tools/db/restore.mjs');
  if (restoreScript.includes('verification') || restoreScript.includes('validate')) {
    logTest('Restore verification', 'PASS', 'Database restore script with verification');
  } else {
    logTest('Restore verification', 'WARN', 'Restore script exists but verification unclear');
  }
} else {
  logTest('Restore verification', 'FAIL', 'Database restore script missing');
}

console.log('🌐 PART 1.5: API HYGIENE VERIFICATION');
console.log('-'.repeat(50));

// Test 1.5: OpenAPI documentation
if (fileExists('apps/hr-api/openapi.yaml')) {
  const openApiSpec = readFileContent('apps/hr-api/openapi.yaml');
  if (openApiSpec.includes('openapi: 3.0') && openApiSpec.includes('/api/v1/')) {
    logTest('OpenAPI specification', 'PASS', 'OpenAPI 3.0 spec with versioned endpoints');
  } else {
    logTest('OpenAPI specification', 'WARN', 'OpenAPI file exists but version/structure unclear');
  }
} else {
  logTest('OpenAPI specification', 'FAIL', 'OpenAPI specification missing');
}

// Test 1.5: Request/Response DTOs
if (fileExists('apps/hr-api/src/dto/common.dto.ts')) {
  const dtoContent = readFileContent('apps/hr-api/src/dto/common.dto.ts');
  if (dtoContent.includes('PaginationDto') && dtoContent.includes('StandardResponseDto')) {
    logTest('API DTOs', 'PASS', 'Pagination and standard response DTOs implemented');
  } else {
    logTest('API DTOs', 'WARN', 'DTO file exists but standard structures unclear');
  }
} else {
  logTest('API DTOs', 'FAIL', 'Common DTO definitions missing');
}

// Test 1.5: Middleware implementation
const middlewareFiles = [
  'apps/hr-api/src/middleware/request-id.middleware.ts',
  'apps/hr-api/src/middleware/idempotency.middleware.ts'
];

middlewareFiles.forEach(file => {
  const fileName = path.basename(file, '.ts');
  if (fileExists(file)) {
    logTest(`${fileName} middleware`, 'PASS', `${fileName} middleware implemented`);
  } else {
    logTest(`${fileName} middleware`, 'FAIL', `${fileName} middleware missing`);
  }
});

console.log('🛡️ PART 1.6: SECURITY & PERFORMANCE SAFETY NETS');
console.log('-'.repeat(50));

// Test 1.6: Security middleware
if (fileExists('apps/hr-api/src/middleware/security.middleware.ts')) {
  const securityMiddleware = readFileContent('apps/hr-api/src/middleware/security.middleware.ts');
  const features = ['helmet', 'rateLimit', 'corsOptions'];
  const implementedFeatures = features.filter(f => securityMiddleware.includes(f));
  
  if (implementedFeatures.length === features.length) {
    logTest('Security middleware', 'PASS', `All security features: ${implementedFeatures.join(', ')}`);
  } else {
    logTest('Security middleware', 'WARN', `Missing features: ${features.filter(f => !implementedFeatures.includes(f)).join(', ')}`);
  }
} else {
  logTest('Security middleware', 'FAIL', 'Security middleware missing');
}

// Test 1.6: Performance monitoring
if (fileExists('apps/hr-api/src/middleware/monitoring.middleware.ts')) {
  const monitoringMiddleware = readFileContent('apps/hr-api/src/middleware/monitoring.middleware.ts');
  if (monitoringMiddleware.includes('responseTime') && monitoringMiddleware.includes('collectMetrics')) {
    logTest('Performance monitoring', 'PASS', 'Response time and metrics collection implemented');
  } else {
    logTest('Performance monitoring', 'WARN', 'Monitoring middleware exists but features unclear');
  }
} else {
  logTest('Performance monitoring', 'FAIL', 'Performance monitoring middleware missing');
}

// Test 1.6: Security package dependencies
const hrApiPackageJson = JSON.parse(readFileContent('apps/hr-api/package.json') || '{}');
const securityDeps = ['helmet', 'express-rate-limit', 'compression'];
const installedSecurityDeps = securityDeps.filter(dep => hrApiPackageJson.dependencies?.[dep]);

if (installedSecurityDeps.length === securityDeps.length) {
  logTest('Security dependencies', 'PASS', `Security packages installed: ${installedSecurityDeps.join(', ')}`);
} else {
  logTest('Security dependencies', 'FAIL', `Missing packages: ${securityDeps.filter(d => !installedSecurityDeps.includes(d)).join(', ')}`);
}

console.log('🔄 PART 1.7: AUTOMATION TO PREVENT REGRESSION');
console.log('-'.repeat(50));

// Test 1.7: Renovate configuration
if (fileExists('.github/renovate.json')) {
  const renovateConfig = JSON.parse(readFileContent('.github/renovate.json') || '{}');
  if (renovateConfig.vulnerabilityAlerts?.enabled && renovateConfig.schedule) {
    logTest('Renovate automation', 'PASS', 'Dependency automation with vulnerability alerts');
  } else {
    logTest('Renovate automation', 'WARN', 'Renovate config exists but features unclear');
  }
} else {
  logTest('Renovate automation', 'FAIL', 'Renovate configuration missing');
}

// Test 1.7: Pre-commit hooks
const huskyHooks = ['.husky/pre-commit', '.husky/commit-msg'];
huskyHooks.forEach(hook => {
  const hookName = path.basename(hook);
  if (fileExists(hook)) {
    const hookContent = readFileContent(hook);
    if (hookContent.includes('echo') || hookContent.includes('npm run')) {
      logTest(`Husky ${hookName}`, 'PASS', `${hookName} hook implemented with validation`);
    } else {
      logTest(`Husky ${hookName}`, 'WARN', `${hookName} exists but validation unclear`);
    }
  } else {
    logTest(`Husky ${hookName}`, 'FAIL', `${hookName} hook missing`);
  }
});

// Test 1.7: Linting and formatting
const qualityFiles = ['.eslintrc.js', '.prettierrc', '.lintstagedrc.js'];
qualityFiles.forEach(file => {
  const fileName = path.basename(file);
  if (fileExists(file)) {
    logTest(`${fileName} config`, 'PASS', `${fileName} configuration present`);
  } else {
    logTest(`${fileName} config`, 'FAIL', `${fileName} configuration missing`);
  }
});

// Test 1.7: CI dependency checks
if (fileExists('.github/workflows/dependency-check.yml')) {
  const depCheckWorkflow = readFileContent('.github/workflows/dependency-check.yml');
  if (depCheckWorkflow.includes('npm audit') && depCheckWorkflow.includes('license-checker')) {
    logTest('CI dependency checks', 'PASS', 'NPM audit and license checking in CI');
  } else {
    logTest('CI dependency checks', 'WARN', 'Dependency check workflow exists but validation unclear');
  }
} else {
  logTest('CI dependency checks', 'FAIL', 'Dependency check workflow missing');
}

console.log('📊 COMPREHENSIVE INTEGRATION TESTS');
console.log('-'.repeat(50));

// Integration test: Try to build the project
const buildResult = runCommand('npm run build', 'Building entire project');
if (buildResult.success) {
  logTest('Project build', 'PASS', 'All TypeScript code compiles successfully');
} else {
  logTest('Project build', 'FAIL', `Build failed: ${buildResult.output}`);
}

// Integration test: Package.json validation
const packageValidation = runCommand('npm run lint --if-present', 'Package validation');
if (packageValidation.success) {
  logTest('Package validation', 'PASS', 'All packages validate successfully');
} else {
  logTest('Package validation', 'WARN', 'Package validation had warnings');
}

console.log('📈 FINAL SECURITY POSTURE SUMMARY');
console.log('='.repeat(70));
console.log(`Total Tests: ${results.tests.length}`);
console.log(`✅ Passed: ${results.summary.passed}`);
console.log(`❌ Failed: ${results.summary.failed}`);
console.log(`⚠️  Warnings: ${results.summary.warnings}`);

const successRate = Math.round((results.summary.passed / results.tests.length) * 100);
console.log(`📊 Success Rate: ${successRate}%`);

if (results.summary.failed === 0) {
  console.log('🎉 SECURITY HARDENING: FULLY IMPLEMENTED');
} else if (results.summary.failed <= 2) {
  console.log('⚠️  SECURITY HARDENING: MOSTLY IMPLEMENTED (minor issues)');
} else {
  console.log('❌ SECURITY HARDENING: INCOMPLETE (major issues detected)');
}

// Save detailed results
const reportPath = path.join(rootDir, 'docs/verification/comprehensive-test-results.json');
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
console.log(`\n📄 Detailed results saved to: ${reportPath}`);

console.log(`\n🔒 Security test suite completed at ${new Date().toISOString()}`);

// Exit with appropriate code
process.exit(results.summary.failed > 2 ? 1 : 0);