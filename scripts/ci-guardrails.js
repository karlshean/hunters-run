#!/usr/bin/env node

/**
 * Local CI Guardrails Runner
 * Runs the same checks as GitHub Actions for local development
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

class CIGuardrails {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  async runCommand(name, command, args = [], options = {}) {
    console.log(`🔍 Running: ${name}`);
    
    return new Promise((resolve) => {
      const isWindows = os.platform() === 'win32';
      
      // Handle Windows command extensions
      if (isWindows && (command === 'npm' || command === 'node')) {
        if (command === 'npm') command = 'npm.cmd';
        options.shell = true;
      }

      const child = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: isWindows && (command.includes('.cmd') || options.shell),
        ...options
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => stdout += data.toString());
      child.stderr?.on('data', (data) => stderr += data.toString());

      child.on('close', (code) => {
        const result = {
          name,
          success: code === 0,
          exitCode: code,
          output: stdout + stderr,
          duration: Date.now() - this.startTime
        };

        if (result.success) {
          console.log(`  ✅ ${name} passed`);
        } else {
          console.log(`  ❌ ${name} failed (exit ${code})`);
          if (stderr) console.log(`     Error: ${stderr.substring(0, 200)}`);
        }

        this.results.push(result);
        resolve(result);
      });

      child.on('error', (error) => {
        console.log(`  💥 ${name} error: ${error.message}`);
        this.results.push({
          name,
          success: false,
          error: error.message,
          duration: Date.now() - this.startTime
        });
        resolve({ success: false, error: error.message });
      });
    });
  }

  async checkFilePatterns() {
    console.log('🔍 Running: Security Pattern Analysis');
    
    const checks = [];
    
    // Check 1: No hardcoded passwords
    const passwordCheck = await this.scanFiles(['apps', 'packages'], /password\s*=\s*['"][^'"]*['"]/, [
      'node_modules', '*.md', '*.log'
    ]);
    
    checks.push({
      name: 'Hardcoded Passwords',
      passed: passwordCheck.matches === 0,
      details: `Found ${passwordCheck.matches} potential hardcoded passwords`
    });

    // Check 2: No SET ROLE in production code
    const setRoleCheck = await this.scanFiles(['apps', 'packages'], /SET\s+ROLE/i, [
      'node_modules', '*.md', 'scripts'
    ]);
    
    checks.push({
      name: 'SET ROLE Usage',
      passed: setRoleCheck.matches === 0,
      details: `Found ${setRoleCheck.matches} SET ROLE statements in production code`
    });

    // Check 3: RLS session variables present
    const rlsVarCheck = await this.scanFiles(['apps'], /set_config.*app\.org_id/i, [
      'node_modules', '*.md'
    ]);
    
    checks.push({
      name: 'RLS Session Variables',
      passed: rlsVarCheck.matches > 0,
      details: `Found ${rlsVarCheck.matches} proper RLS session variable usages`
    });

    const allPassed = checks.every(check => check.passed);
    
    console.log(`  ${allPassed ? '✅' : '❌'} Security Pattern Analysis ${allPassed ? 'passed' : 'failed'}`);
    checks.forEach(check => {
      console.log(`    ${check.passed ? '✅' : '❌'} ${check.name}: ${check.details}`);
    });

    return {
      name: 'Security Pattern Analysis',
      success: allPassed,
      checks,
      duration: Date.now() - this.startTime
    };
  }

  async scanFiles(directories, pattern, excludePatterns = []) {
    const matches = [];
    
    for (const dir of directories) {
      if (!fs.existsSync(dir)) continue;
      
      const files = this.getAllFiles(dir, excludePatterns);
      
      for (const file of files) {
        try {
          const content = fs.readFileSync(file, 'utf8');
          const fileMatches = content.match(pattern);
          
          if (fileMatches) {
            matches.push(...fileMatches.map(match => ({ file, match })));
          }
        } catch (error) {
          // Skip files we can't read
        }
      }
    }
    
    return { matches: matches.length, details: matches };
  }

  getAllFiles(dirPath, excludePatterns = []) {
    const files = [];
    
    try {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        
        // Skip excluded patterns
        if (excludePatterns.some(pattern => 
          item.includes(pattern) || fullPath.includes(pattern))) {
          continue;
        }
        
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          files.push(...this.getAllFiles(fullPath, excludePatterns));
        } else if (stat.isFile() && (item.endsWith('.js') || item.endsWith('.ts'))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't access
    }
    
    return files;
  }

  async runAll() {
    console.log('🛡️ RUNNING CI SECURITY GUARDRAILS');
    console.log('==================================\n');

    const guardrails = [
      // 1. TypeScript Build Check
      {
        name: 'TypeScript Build',
        run: () => this.runCommand('TypeScript Build', 'npm', ['run', 'build'], { cwd: 'apps/hr-api' })
      },

      // 2. Cross-Platform Scripts
      {
        name: 'Cross-Platform Scripts',
        run: () => this.runCommand('Smoke Test', 'node', ['scripts/diagnostics/test-smoke.mjs'])
      },

      // 3. Dependency Audit
      {
        name: 'Dependency Audit',
        run: () => this.runCommand('Dependency Audit', 'node', ['scripts/dependency-audit.js'])
      },

      // 4. Firebase Config Check
      {
        name: 'Firebase Config',  
        run: () => this.runCommand('Firebase Config', 'node', ['scripts/detect-env-path.js'])
      },

      // 5. Security Pattern Analysis
      {
        name: 'Security Patterns',
        run: () => this.checkFilePatterns()
      }
    ];

    for (const guardrail of guardrails) {
      await guardrail.run();
    }

    this.printSummary();
  }

  printSummary() {
    console.log('\n📊 GUARDRAILS SUMMARY');
    console.log('===================\n');

    const passed = this.results.filter(r => r.success).length;
    const total = this.results.length;
    const duration = Math.round((Date.now() - this.startTime) / 1000);

    console.log(`Results: ${passed}/${total} passed (${duration}s)`);
    console.log('');

    this.results.forEach(result => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${result.name}`);
    });

    const allPassed = passed === total;
    console.log('');
    console.log(`Overall Status: ${allPassed ? '✅ ALL GUARDRAILS PASSED' : '❌ SOME GUARDRAILS FAILED'}`);
    
    if (allPassed) {
      console.log('🚀 Safe to deploy - no security regressions detected');
    } else {
      console.log('🚫 Deployment blocked - fix failing guardrails before deploying');
    }

    // Save results for CI integration
    const reportPath = 'reports/artifacts/ci-guardrails.json';
    const report = {
      timestamp: new Date().toISOString(),
      duration,
      summary: {
        total,
        passed,
        failed: total - passed,
        success: allPassed
      },
      results: this.results
    };

    try {
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n💾 Report saved to: ${reportPath}`);
    } catch (error) {
      console.log(`\n⚠️ Could not save report: ${error.message}`);
    }

    process.exit(allPassed ? 0 : 1);
  }
}

// Run if called directly
if (require.main === module) {
  const guardrails = new CIGuardrails();
  guardrails.runAll().catch(console.error);
}

module.exports = CIGuardrails;