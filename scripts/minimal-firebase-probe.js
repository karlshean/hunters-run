// Minimal Firebase Admin verification without external dependencies
(async () => {
  try {
    console.log('=== MINIMAL FIREBASE CONFIG PROBE ===');
    const timestamp = new Date().toISOString();
    console.log('Timestamp:', timestamp);
    console.log('');

    // Load config from environment
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    console.log('1. Environment Variable Check:');
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
    console.log('\n3. Private Key Parsing Test:');
    if (privateKey) {
      try {
        const normalizedKey = privateKey.replace(/\\n/g, '\n');
        const keyLines = normalizedKey.split('\n');
        const hasHeader = keyLines.some(line => line.includes('BEGIN PRIVATE KEY'));
        const hasFooter = keyLines.some(line => line.includes('END PRIVATE KEY'));
        const hasContent = keyLines.some(line => line.length > 60 && !line.includes('KEY'));

        if (hasHeader && hasFooter && hasContent) {
          console.log('  ✅ Private key structure valid');
        } else {
          status = 'FAIL';
          console.log('  ❌ Private key structure invalid');
          issues.push('Malformed private key content');
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
      const expectedProject = clientEmail.split('@')[1]?.split('.')[0];
      if (expectedProject && clientEmail.includes(projectId)) {
        console.log('  ✅ Client email matches project ID');
      } else {
        status = 'FAIL';
        console.log('  ❌ Client email does not match project ID');
        issues.push('Project ID/client email mismatch');
      }
    }

    console.log('\n=== VERIFICATION RESULT ===');
    if (status === 'PASS') {
      console.log('✅ PASS: Firebase configuration valid');
      console.log('✅ All required environment variables present');
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
        format_validation: issues.length === 0 ? 'PASS' : 'FAIL',
        consistency_check: clientEmail && projectId && clientEmail.includes(projectId) ? 'PASS' : 'FAIL'
      },
      config_source: '.env file',
      project_id_provided: !!projectId,
      client_email_provided: !!clientEmail,
      private_key_provided: !!privateKey
    };

    console.log('\n=== SUMMARY FOR DOCUMENTATION ===');
    console.log(JSON.stringify(summary, null, 2));

    process.exit(status === 'PASS' ? 0 : 1);

  } catch (error) {
    console.error('❌ FAIL: Firebase validation crashed:', error.message);
    process.exit(1);
  }
})();