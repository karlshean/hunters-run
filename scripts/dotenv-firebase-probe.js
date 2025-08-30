const fs = require('fs');

// Simple .env parser
function loadEnvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const env = {};
    
    content.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          let value = valueParts.join('=').trim();
          // Remove surrounding quotes
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          env[key] = value;
        }
      }
    });
    
    return env;
  } catch (error) {
    console.error('Error loading .env file:', error.message);
    return {};
  }
}

(async () => {
  try {
    console.log('=== FIREBASE CONFIG PROBE WITH .ENV LOADING ===');
    const timestamp = new Date().toISOString();
    console.log('Timestamp:', timestamp);
    console.log('');

    // Load .env file manually
    const env = loadEnvFile('.env');
    
    const projectId = env.FIREBASE_PROJECT_ID;
    const clientEmail = env.FIREBASE_CLIENT_EMAIL;
    const privateKey = env.FIREBASE_PRIVATE_KEY;

    console.log('1. Environment Variable Check (.env file):');
    console.log('  FIREBASE_PROJECT_ID:', projectId || '❌ MISSING');
    console.log('  FIREBASE_CLIENT_EMAIL:', clientEmail ? '✅ PROVIDED' : '❌ MISSING');
    console.log('  FIREBASE_PRIVATE_KEY:', privateKey ? '✅ PROVIDED' : '❌ MISSING');

    let status = 'PASS';
    let issues = [];

    // Validate project ID format
    if (!projectId) {
      status = 'FAIL';
      issues.push('Missing FIREBASE_PROJECT_ID');
    } else if (!projectId.match(/^[a-z0-9-]+$/)) {
      status = 'FAIL';
      issues.push('Invalid FIREBASE_PROJECT_ID format');
    }

    // Validate client email format
    if (!clientEmail) {
      status = 'FAIL';
      issues.push('Missing FIREBASE_CLIENT_EMAIL');
    } else if (!clientEmail.includes('@') || !clientEmail.includes('.iam.gserviceaccount.com')) {
      status = 'FAIL';
      issues.push('Invalid FIREBASE_CLIENT_EMAIL format');
    }

    // Validate private key format
    if (!privateKey) {
      status = 'FAIL';
      issues.push('Missing FIREBASE_PRIVATE_KEY');
    } else if (!privateKey.includes('-----BEGIN PRIVATE KEY-----') || !privateKey.includes('-----END PRIVATE KEY-----')) {
      status = 'FAIL';
      issues.push('Invalid FIREBASE_PRIVATE_KEY format');
    }

    console.log('\n2. Configuration Format Validation:');
    if (status === 'PASS') {
      console.log('  ✅ Project ID format valid');
      console.log('  ✅ Client email format valid');
      console.log('  ✅ Private key format valid');
    } else {
      issues.forEach(issue => console.log('  ❌', issue));
    }

    // Test private key parsing
    console.log('\n3. Private Key Structure Analysis:');
    if (privateKey) {
      try {
        const normalizedKey = privateKey.replace(/\\n/g, '\n');
        const keyLines = normalizedKey.split('\n');
        const hasHeader = keyLines.some(line => line.includes('BEGIN PRIVATE KEY'));
        const hasFooter = keyLines.some(line => line.includes('END PRIVATE KEY'));
        const hasContent = keyLines.some(line => line.length > 60 && !line.includes('KEY'));

        console.log('  Header present:', hasHeader ? '✅ YES' : '❌ NO');
        console.log('  Footer present:', hasFooter ? '✅ YES' : '❌ NO');
        console.log('  Key content present:', hasContent ? '✅ YES' : '❌ NO');
        console.log('  Total lines:', keyLines.length);

        if (!hasHeader || !hasFooter || !hasContent) {
          status = 'FAIL';
          issues.push('Malformed private key structure');
        }
      } catch (parseError) {
        status = 'FAIL';
        console.log('  ❌ Private key parsing failed:', parseError.message);
        issues.push('Private key parsing error');
      }
    }

    // Email/Project ID consistency check
    console.log('\n4. Service Account Consistency:');
    if (clientEmail && projectId) {
      if (clientEmail.includes(projectId)) {
        console.log('  ✅ Client email matches project ID');
      } else {
        status = 'FAIL';
        console.log('  ❌ Client email does not match project ID');
        console.log('    Project ID:', projectId);
        console.log('    Client email project:', clientEmail.split('@')[1]?.split('.')[0]);
        issues.push('Project ID/client email mismatch');
      }
    }

    console.log('\n=== VERIFICATION RESULT ===');
    if (status === 'PASS') {
      console.log('✅ PASS: Firebase configuration valid');
      console.log('✅ All required environment variables present in .env');
      console.log('✅ Configuration format correct');
      console.log('✅ Service account consistency verified');
    } else {
      console.log('❌ FAIL: Firebase configuration issues detected');
      issues.forEach(issue => console.log('  -', issue));
    }

    // Summary for config-sanity.md
    const summary = {
      timestamp,
      test_type: 'firebase_configuration_validation',
      status,
      issues: issues.length > 0 ? issues : null,
      components_checked: {
        environment_variables: projectId && clientEmail && privateKey ? 'PASS' : 'FAIL',
        format_validation: issues.filter(i => i.includes('format') || i.includes('structure')).length === 0 ? 'PASS' : 'FAIL',
        consistency_check: clientEmail && projectId && clientEmail.includes(projectId) ? 'PASS' : 'FAIL'
      },
      config_source: '.env file (manually parsed)',
      project_id: projectId || null,
      client_email_format: clientEmail && clientEmail.includes('@') ? 'VALID' : 'INVALID',
      private_key_format: privateKey && privateKey.includes('BEGIN PRIVATE KEY') ? 'VALID' : 'INVALID'
    };

    console.log('\n=== SUMMARY FOR DOCUMENTATION ===');
    console.log(JSON.stringify(summary, null, 2));

    process.exit(status === 'PASS' ? 0 : 1);

  } catch (error) {
    console.error('❌ FAIL: Firebase validation crashed:', error.message);
    process.exit(1);
  }
})();