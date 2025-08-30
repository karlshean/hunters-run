import * as dotenvSafe from 'dotenv-safe';
import { join } from 'path';

// Load environment variables with validation
dotenvSafe.config({
  path: process.env.ENV_FILE || '.env',
  example: '.env.example',
  allowEmptyValues: false,
});

export interface EnvironmentConfig {
  // Database
  DATABASE_URL: string;
  DB_SSL_MODE: 'strict' | 'relaxed';
  
  // Firebase - support both approaches
  FIREBASE_PROJECT_ID: string;
  FIREBASE_SERVICE_ACCOUNT_PATH?: string;
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
  
  // Application
  NODE_ENV: 'development' | 'staging' | 'production' | 'test';
  PORT: number;
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';
  
  // Optional AWS
  AWS_REGION?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_S3_BUCKET?: string;
  
  // Optional Feature Flags
  TENANT_PHOTO_FLOW_ENABLED?: boolean;
  
  // Optional Development
  DEV_AUTH_BYPASS?: boolean;
  DEV_USER_SUB?: string;
}

function validateEnvironment(): EnvironmentConfig {
  const requiredKeys = [
    'DATABASE_URL',
    'DB_SSL_MODE', 
    'FIREBASE_PROJECT_ID',
    'NODE_ENV',
    'PORT'
  ];
  
  // Check required keys
  const missing: string[] = [];
  for (const key of requiredKeys) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }
  
  // Firebase configuration validation
  const hasServiceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH && 
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH !== 'PLACEHOLDER';
  const hasServiceAccountJSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON && 
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON !== 'PLACEHOLDER';
    
  if (!hasServiceAccountPath && !hasServiceAccountJSON) {
    missing.push('FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON');
  }
  
  if (missing.length > 0) {
    console.error('❌ CONFIGURATION ERROR: Missing required environment variables:');
    missing.forEach(key => {
      console.error(`   - ${key}`);
    });
    console.error('');
    console.error('Please check your .env file and ensure all required variables are set.');
    console.error('Refer to .env.example for the complete list of required variables.');
    process.exit(1);
  }
  
  // Validate DB_SSL_MODE
  if (!['strict', 'relaxed'].includes(process.env.DB_SSL_MODE!)) {
    console.error('❌ CONFIGURATION ERROR: DB_SSL_MODE must be "strict" or "relaxed"');
    process.exit(1);
  }
  
  return {
    DATABASE_URL: process.env.DATABASE_URL!,
    DB_SSL_MODE: process.env.DB_SSL_MODE as 'strict' | 'relaxed',
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID!,
    FIREBASE_SERVICE_ACCOUNT_PATH: hasServiceAccountPath ? process.env.FIREBASE_SERVICE_ACCOUNT_PATH : undefined,
    FIREBASE_SERVICE_ACCOUNT_JSON: hasServiceAccountJSON ? process.env.FIREBASE_SERVICE_ACCOUNT_JSON : undefined,
    NODE_ENV: process.env.NODE_ENV as 'development' | 'staging' | 'production' | 'test',
    PORT: parseInt(process.env.PORT!, 10),
    LOG_LEVEL: (process.env.LOG_LEVEL as any) || 'info',
    AWS_REGION: process.env.AWS_REGION,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
    TENANT_PHOTO_FLOW_ENABLED: process.env.TENANT_PHOTO_FLOW_ENABLED === 'true',
    DEV_AUTH_BYPASS: process.env.DEV_AUTH_BYPASS === 'true',
    DEV_USER_SUB: process.env.DEV_USER_SUB
  };
}

// Export validated configuration
export const config = validateEnvironment();

// Log configuration status (without values)
console.log('✅ Environment configuration validated successfully');
console.log(`   NODE_ENV: ${config.NODE_ENV}`);
console.log(`   PORT: ${config.PORT}`);
console.log(`   DB_SSL_MODE: ${config.DB_SSL_MODE}`);
console.log(`   Firebase auth method: ${config.FIREBASE_SERVICE_ACCOUNT_PATH ? 'SERVICE_ACCOUNT_PATH' : 'SERVICE_ACCOUNT_JSON'}`);
if (config.TENANT_PHOTO_FLOW_ENABLED) {
  console.log('   🖼️  Tenant photo flow: ENABLED');
}
if (config.DEV_AUTH_BYPASS) {
  console.log('   🔓 Development auth bypass: ENABLED');
}