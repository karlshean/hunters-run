#!/usr/bin/env node

/**
 * Staging Deployment Script for Hunters Run HR API
 * 
 * This script handles deployment to staging environment with health checks
 * and basic API validation.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const https = require('https');
const http = require('http');

class StagingDeployer {
  constructor() {
    this.stagingPort = process.env.STAGING_PORT || 3000;
    this.stagingHost = process.env.STAGING_HOST || 'localhost';
    this.apiBaseUrl = `http://${this.stagingHost}:${this.stagingPort}`;
    this.healthTimeout = 30000; // 30 seconds
    this.deploymentId = new Date().toISOString().replace(/[:.]/g, '-');
  }

  log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }

  error(message, error = null) {
    console.error(`[${new Date().toISOString()}] ERROR: ${message}`);
    if (error) console.error(error);
  }

  async httpRequest(url, options = {}) {
    return new Promise((resolve) => {
      const lib = url.startsWith('https://') ? https : http;
      
      const req = lib.get(url, {
        timeout: 5000,
        ...options
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
            success: res.statusCode >= 200 && res.statusCode < 400
          });
        });
      });

      req.on('error', (err) => {
        resolve({
          status: 0,
          success: false,
          error: err.message
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          status: 0,
          success: false,
          error: 'Request timeout'
        });
      });
    });
  }

  async checkStagingEnv() {
    this.log('Checking staging environment configuration...');
    
    const envPath = path.join('apps', 'hr-api', '.env.staging');
    if (!fs.existsSync(envPath)) {
      throw new Error(`Staging environment file not found: ${envPath}\nCopy .env.staging.example and populate with real values.`);
    }

    // Load and validate required environment variables
    const envContent = fs.readFileSync(envPath, 'utf8');
    const requiredVars = [
      'DATABASE_URL',
      'FIREBASE_PROJECT_ID', 
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_PRIVATE_KEY'
    ];

    const missingVars = requiredVars.filter(varName => 
      !envContent.includes(`${varName}=`) || 
      envContent.includes(`${varName}=STAGING_`) ||
      envContent.includes(`${varName}=PROJECT_ID`)
    );

    if (missingVars.length > 0) {
      throw new Error(`Missing or placeholder values in staging env: ${missingVars.join(', ')}`);
    }

    this.log('✅ Staging environment configuration validated');
  }

  async buildApplication() {
    this.log('Building hr-api for staging deployment...');
    
    return new Promise((resolve, reject) => {
      const buildProcess = spawn('npm', ['run', 'build'], {
        cwd: path.join('apps', 'hr-api'),
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      buildProcess.stdout.on('data', (data) => {
        stdout += data;
      });

      buildProcess.stderr.on('data', (data) => {
        stderr += data;
      });

      buildProcess.on('close', (code) => {
        if (code === 0) {
          this.log('✅ Build completed successfully');
          resolve({ success: true, output: stdout });
        } else {
          this.error('Build failed', stderr);
          reject(new Error(`Build failed with exit code ${code}: ${stderr}`));
        }
      });
    });
  }

  async startStagingServer() {
    this.log(`Starting staging server on port ${this.stagingPort}...`);
    
    const serverProcess = spawn('node', ['dist/main.js'], {
      cwd: path.join('apps', 'hr-api'),
      env: {
        ...process.env,
        NODE_ENV: 'staging',
        PORT: this.stagingPort.toString()
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });

    // Store process reference for potential cleanup
    this.serverProcess = serverProcess;

    let stdout = '';
    let stderr = '';

    serverProcess.stdout.on('data', (data) => {
      stdout += data;
      // Look for server startup indicators
      if (data.toString().includes('listening') || data.toString().includes('started')) {
        this.log('Server startup detected in logs');
      }
    });

    serverProcess.stderr.on('data', (data) => {
      stderr += data;
      // Log any errors but don't fail immediately
      if (data.toString().trim()) {
        this.log(`Server stderr: ${data.toString().trim()}`);
      }
    });

    serverProcess.on('close', (code) => {
      this.log(`Server process exited with code ${code}`);
    });

    // Give server time to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    return { process: serverProcess, stdout, stderr };
  }

  async waitForHealth() {
    this.log('Waiting for health check to pass...');
    
    const startTime = Date.now();
    const maxWait = this.healthTimeout;
    
    while (Date.now() - startTime < maxWait) {
      try {
        const healthUrl = `${this.apiBaseUrl}/api/health`;
        const response = await this.httpRequest(healthUrl);
        
        if (response.success) {
          this.log('✅ Health check passed');
          return response;
        } else {
          this.log(`Health check failed: ${response.status} - ${response.error || 'Unknown error'}`);
        }
      } catch (error) {
        this.log(`Health check error: ${error.message}`);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error(`Health check failed after ${maxWait}ms`);
  }

  async validateStagingApis() {
    this.log('Validating staging API endpoints...');
    
    const validationResults = [];
    
    // Test valid org IDs (these should exist in staging data)
    const testOrgIds = [
      '00000000-0000-4000-8000-000000000001', // Demo Organization
      '00000000-0000-4000-8000-000000000002'  // Test Organization
    ];

    for (const orgId of testOrgIds) {
      // Test properties endpoint
      const propertiesUrl = `${this.apiBaseUrl}/api/properties`;
      const propertiesResponse = await this.httpRequest(propertiesUrl, {
        headers: {
          'Authorization': 'Bearer dev-token',
          'x-org-id': orgId
        }
      });

      validationResults.push({
        endpoint: '/api/properties',
        orgId,
        status: propertiesResponse.status,
        success: propertiesResponse.success,
        count: this.extractCount(propertiesResponse.body),
        error: propertiesResponse.error
      });

      // Test work orders endpoint  
      const workOrdersUrl = `${this.apiBaseUrl}/api/work-orders`;
      const workOrdersResponse = await this.httpRequest(workOrdersUrl, {
        headers: {
          'Authorization': 'Bearer dev-token',
          'x-org-id': orgId
        }
      });

      validationResults.push({
        endpoint: '/api/work-orders',
        orgId,
        status: workOrdersResponse.status,
        success: workOrdersResponse.success,
        count: this.extractCount(workOrdersResponse.body),
        error: workOrdersResponse.error
      });
    }

    return validationResults;
  }

  extractCount(responseBody) {
    try {
      const parsed = JSON.parse(responseBody);
      return parsed.count || (parsed.items ? parsed.items.length : 0);
    } catch (error) {
      return 'unknown';
    }
  }

  async generateValidationReport(validationResults) {
    const timestamp = new Date().toISOString();
    const reportPath = path.join('docs', 'verification', 'staging-validation.md');
    
    let report = `# Staging Validation Report\n\n`;
    report += `**Generated:** ${timestamp}\n`;
    report += `**Deployment ID:** ${this.deploymentId}\n`;
    report += `**API Base URL:** ${this.apiBaseUrl}\n\n`;
    
    report += `## Health Check Results\n\n`;
    report += `✅ Health endpoint: 200 OK\n\n`;
    
    report += `## API Endpoint Validation\n\n`;
    report += `| Endpoint | Org ID | Status | Count | Result |\n`;
    report += `|----------|--------|--------|-------|--------|\n`;
    
    validationResults.forEach(result => {
      const status = result.success ? `✅ ${result.status}` : `❌ ${result.status}`;
      const orgIdShort = result.orgId.substring(0, 8) + '...';
      report += `| ${result.endpoint} | ${orgIdShort} | ${status} | ${result.count} | ${result.success ? 'PASS' : 'FAIL'} |\n`;
    });
    
    report += `\n## Summary\n\n`;
    const successCount = validationResults.filter(r => r.success).length;
    const totalCount = validationResults.length;
    report += `- **Total Tests:** ${totalCount}\n`;
    report += `- **Passed:** ${successCount}\n`;
    report += `- **Failed:** ${totalCount - successCount}\n`;
    report += `- **Success Rate:** ${Math.round((successCount / totalCount) * 100)}%\n\n`;
    
    if (successCount === totalCount) {
      report += `✅ **All staging validation tests passed**\n`;
    } else {
      report += `❌ **Some staging validation tests failed**\n`;
    }
    
    // Ensure directory exists
    const reportDir = path.dirname(reportPath);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, report);
    this.log(`Validation report saved to: ${reportPath}`);
    
    return { reportPath, successCount, totalCount };
  }

  async deploy() {
    try {
      this.log(`🚀 Starting staging deployment: ${this.deploymentId}`);
      
      // Step 1: Check staging environment
      await this.checkStagingEnv();
      
      // Step 2: Build application
      await this.buildApplication();
      
      // Step 3: Start staging server
      await this.startStagingServer();
      
      // Step 4: Wait for health check
      await this.waitForHealth();
      
      // Step 5: Validate API endpoints
      const validationResults = await this.validateStagingApis();
      
      // Step 6: Generate validation report
      const report = await this.generateValidationReport(validationResults);
      
      this.log(`✅ Staging deployment completed successfully`);
      this.log(`📊 Validation: ${report.successCount}/${report.totalCount} tests passed`);
      
      return {
        success: true,
        deploymentId: this.deploymentId,
        validationResults,
        reportPath: report.reportPath
      };
      
    } catch (error) {
      this.error('Staging deployment failed', error);
      
      // Cleanup server process if it was started
      if (this.serverProcess) {
        this.log('Cleaning up server process...');
        this.serverProcess.kill();
      }
      
      throw error;
    }
  }
}

// Run deployment if called directly
if (require.main === module) {
  const deployer = new StagingDeployer();
  
  deployer.deploy()
    .then((result) => {
      console.log('\n🎉 STAGING DEPLOYMENT SUCCESSFUL');
      console.log(`Report: ${result.reportPath}`);
      
      // Keep server running for manual testing
      console.log('\n💡 Server is running for manual testing');
      console.log(`Health: ${deployer.apiBaseUrl}/api/health`);
      console.log('Press Ctrl+C to stop the server');
      
    })
    .catch((error) => {
      console.error('\n❌ STAGING DEPLOYMENT FAILED');
      console.error(error.message);
      process.exit(1);
    });
}

module.exports = StagingDeployer;