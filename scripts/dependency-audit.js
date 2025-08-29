#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

/**
 * Simple dependency audit and update checker
 * Time-boxed to focus on high-impact dependencies
 */

const CRITICAL_DEPENDENCIES = [
  'typescript',
  '@nestjs/common',
  '@nestjs/core', 
  'typeorm',
  'pg',
  'reflect-metadata',
  'body-parser',
  'nodemon'
];

function readPackageJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return null;
  }
}

function getLatestVersion(packageName, timeout = 3000) {
  return new Promise((resolve) => {
    const url = `https://registry.npmjs.org/${packageName}/latest`;
    
    const req = https.get(url, { timeout }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const info = JSON.parse(data);
          resolve(info.version);
        } catch (error) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

function parseVersion(version) {
  return version.replace(/^\^|~/, '').split('.').map(Number);
}

function isNewer(current, latest) {
  const currentParts = parseVersion(current);
  const latestParts = parseVersion(latest);
  
  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const currentPart = currentParts[i] || 0;
    const latestPart = latestParts[i] || 0;
    
    if (latestPart > currentPart) return true;
    if (latestPart < currentPart) return false;
  }
  
  return false;
}

async function auditPackage(packagePath, packageName) {
  console.log(`\n📦 Auditing: ${packageName}`);
  console.log(`📂 Path: ${packagePath}`);
  
  const pkg = readPackageJson(path.join(packagePath, 'package.json'));
  if (!pkg) {
    console.log('❌ Could not read package.json');
    return { package: packageName, status: 'error', details: 'Cannot read package.json' };
  }

  const allDeps = { 
    ...pkg.dependencies, 
    ...pkg.devDependencies 
  };

  const results = [];
  const depsToCheck = Object.keys(allDeps).filter(dep => 
    CRITICAL_DEPENDENCIES.includes(dep) || dep.startsWith('@nestjs')
  );

  console.log(`🔍 Checking ${depsToCheck.length} critical dependencies...`);

  for (const dep of depsToCheck) {
    const currentVersion = allDeps[dep];
    
    if (currentVersion.startsWith('workspace:')) {
      console.log(`  ${dep}: ${currentVersion} (workspace - skipping)`);
      continue;
    }

    console.log(`  ${dep}: ${currentVersion} → checking latest...`);
    const latestVersion = await getLatestVersion(dep);
    
    if (!latestVersion) {
      console.log(`    ⚠️  Could not fetch latest version`);
      results.push({ dep, current: currentVersion, latest: 'unknown', needsUpdate: false, status: 'unknown' });
      continue;
    }

    const needsUpdate = isNewer(currentVersion, latestVersion);
    const status = needsUpdate ? 'outdated' : 'current';
    
    console.log(`    ${needsUpdate ? '⚠️ ' : '✅ '} Latest: ${latestVersion} ${needsUpdate ? '(UPDATE AVAILABLE)' : '(current)'}`);
    
    results.push({
      dep,
      current: currentVersion,
      latest: latestVersion,
      needsUpdate,
      status
    });
  }

  return {
    package: packageName,
    path: packagePath,
    totalDeps: Object.keys(allDeps).length,
    criticalDeps: depsToCheck.length,
    dependencies: results,
    hasUpdates: results.some(r => r.needsUpdate),
    status: results.some(r => r.needsUpdate) ? 'has-updates' : 'current'
  };
}

async function main() {
  console.log('🔧 DEPENDENCY DRIFT AUDIT');
  console.log('⏱️  Time-boxed to critical dependencies only\n');

  const packagesToCheck = [
    { name: 'root', path: '.' },
    { name: '@apps/hr-api', path: 'apps/hr-api' },
    { name: '@platform/db', path: 'packages/db' },
    { name: '@platform/auth', path: 'packages/auth' },
    { name: '@platform/shared', path: 'packages/shared' }
  ];

  const auditResults = [];
  
  for (const pkg of packagesToCheck) {
    const result = await auditPackage(pkg.path, pkg.name);
    auditResults.push(result);
  }

  // Summary
  console.log('\n📊 AUDIT SUMMARY');
  console.log('================\n');

  let totalPackages = 0;
  let packagesWithUpdates = 0;
  let totalUpdatesAvailable = 0;

  auditResults.forEach(result => {
    if (result.status === 'error') {
      console.log(`❌ ${result.package}: ${result.details}`);
      return;
    }

    totalPackages++;
    if (result.hasUpdates) {
      packagesWithUpdates++;
      const updateCount = result.dependencies.filter(d => d.needsUpdate).length;
      totalUpdatesAvailable += updateCount;
      
      console.log(`⚠️  ${result.package}: ${updateCount} updates available`);
      result.dependencies
        .filter(d => d.needsUpdate)
        .forEach(d => {
          console.log(`    ${d.dep}: ${d.current} → ${d.latest}`);
        });
    } else {
      console.log(`✅ ${result.package}: All critical dependencies current`);
    }
  });

  console.log(`\n📈 Overall Status:`);
  console.log(`   Packages audited: ${totalPackages}`);
  console.log(`   Packages with updates: ${packagesWithUpdates}`);
  console.log(`   Total updates available: ${totalUpdatesAvailable}`);
  
  const auditStatus = totalUpdatesAvailable === 0 ? 'CURRENT' : 
                      totalUpdatesAvailable <= 5 ? 'MINOR_DRIFT' : 'MAJOR_DRIFT';
  console.log(`   Status: ${auditStatus}`);

  // Save detailed results
  const timestamp = new Date().toISOString();
  const reportPath = 'reports/artifacts/dep-drift.json';
  
  const report = {
    timestamp,
    auditStatus,
    summary: {
      totalPackages,
      packagesWithUpdates,
      totalUpdatesAvailable
    },
    packages: auditResults
  };

  try {
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Detailed report saved to: ${reportPath}`);
  } catch (error) {
    console.log(`\n⚠️  Could not save report: ${error.message}`);
  }

  console.log(`\n🎯 Time-boxed audit complete - focused on ${CRITICAL_DEPENDENCIES.length} critical dependencies`);
}

main().catch(console.error);