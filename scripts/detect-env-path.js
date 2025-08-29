const path = require('path');
const fs = require('fs');

console.log('=== FIREBASE ENV DETECTION ===');
console.log('Timestamp:', new Date().toISOString());
console.log('');

// NestJS ConfigModule.forRoot() default behavior
const projectRoot = process.cwd();
const expectedEnvPath = path.join(projectRoot, '.env');

console.log('1. Environment Loading Analysis:');
console.log('  NestJS ConfigModule: ConfigModule.forRoot({ isGlobal: true })');
console.log('  Default env path:', expectedEnvPath);
console.log('  Path exists:', fs.existsSync(expectedEnvPath) ? '✅ YES' : '❌ NO');
console.log('');

if (fs.existsSync(expectedEnvPath)) {
  console.log('2. Firebase Environment Variables Check:');
  
  const envContent = fs.readFileSync(expectedEnvPath, 'utf8');
  const requiredKeys = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL', 
    'FIREBASE_PRIVATE_KEY'
  ];
  
  const findings = {};
  
  requiredKeys.forEach(key => {
    const regex = new RegExp(`^${key}=`, 'm');
    const found = regex.test(envContent);
    findings[key] = found;
    console.log(`  ${key}: ${found ? '✅ PRESENT' : '❌ MISSING'}`);
  });
  
  console.log('');
  console.log('3. Summary:');
  const allPresent = Object.values(findings).every(present => present);
  console.log('  All Firebase keys present:', allPresent ? '✅ YES' : '❌ NO');
  console.log('  Environment file path:', expectedEnvPath);
  
  const result = {
    timestamp: new Date().toISOString(),
    envPath: expectedEnvPath,
    pathExists: true,
    requiredKeys: findings,
    allKeysPresent: allPresent,
    status: allPresent ? 'READY' : 'MISSING_KEYS'
  };
  
  console.log('');
  console.log('=== DETECTION RESULT ===');
  console.log(JSON.stringify(result, null, 2));
  
} else {
  console.log('2. Environment file not found');
  console.log('  Expected path:', expectedEnvPath);
  console.log('  Status: ❌ FILE_NOT_FOUND');
}