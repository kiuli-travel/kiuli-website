#!/usr/bin/env node

/**
 * Phase 0: Environment & Prerequisite Validation
 * This script validates all required environment variables and dependencies
 * before proceeding with the Kiuli Scraper build.
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { execSync } = require('child_process');
const https = require('https');
const http = require('http');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

// Track validation results
const results = {
  passed: [],
  failed: [],
};

// Helper function to log with color
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Helper function to execute shell commands
function executeCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: 'pipe' });
  } catch (error) {
    return null;
  }
}

// Helper function to fetch from URL
function fetchUrl(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const urlObj = new URL(url);

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: headers,
    };

    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data }));
    });

    req.on('error', reject);
    req.setTimeout(20000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

// Check 1: Node.js Version
async function checkNodeVersion() {
  log('\n[1/5] Checking Node.js version...', colors.blue);

  try {
    const version = process.version;
    const majorVersion = parseInt(version.slice(1).split('.')[0]);

    if (majorVersion >= 18) {
      log(`  ✓ Node.js version: ${version} (>= 18.x)`, colors.green);
      results.passed.push('Node.js Version');
      return true;
    } else {
      log(`  ✗ Node.js version: ${version} (requires >= 18.x)`, colors.red);
      results.failed.push('Node.js Version');
      return false;
    }
  } catch (error) {
    log(`  ✗ Failed to check Node.js version: ${error.message}`, colors.red);
    results.failed.push('Node.js Version');
    return false;
  }
}

// Check 2: Vercel CLI
async function checkVercelCLI() {
  log('\n[2/5] Checking Vercel CLI...', colors.blue);

  try {
    const output = executeCommand('vercel --version');

    if (output) {
      log(`  ✓ Vercel CLI installed: ${output.trim()}`, colors.green);
      results.passed.push('Vercel CLI');
      return true;
    } else {
      log('  ✗ Vercel CLI not found or failed to execute', colors.red);
      results.failed.push('Vercel CLI');
      return false;
    }
  } catch (error) {
    log(`  ✗ Vercel CLI check failed: ${error.message}`, colors.red);
    results.failed.push('Vercel CLI');
    return false;
  }
}

// Check 3: Payload CMS API
async function checkPayloadAPI() {
  log('\n[3/5] Checking Payload CMS API...', colors.blue);

  try {
    // Check environment variables
    const apiUrl = process.env.PAYLOAD_API_URL;
    const apiKey = process.env.PAYLOAD_API_KEY;

    if (!apiUrl) {
      log('  ✗ PAYLOAD_API_URL environment variable not set', colors.red);
      results.failed.push('Payload CMS API');
      return false;
    }

    if (!apiKey) {
      log('  ✗ PAYLOAD_API_KEY environment variable not set', colors.red);
      results.failed.push('Payload CMS API');
      return false;
    }

    log(`  ✓ PAYLOAD_API_URL: ${apiUrl}`, colors.green);
    log(`  ✓ PAYLOAD_API_KEY: ${apiKey.substring(0, 8)}...`, colors.green);

    // Attempt authenticated request
    log('  → Testing API connection...', colors.yellow);

    const testUrl = `${apiUrl}/api/users/me`;
    const response = await fetchUrl(testUrl, {
      'Authorization': `users API-Key ${apiKey}`,
      'Content-Type': 'application/json',
    });

    if (response.statusCode === 200 || response.statusCode === 201) {
      log(`  ✓ Payload API responded with status ${response.statusCode}`, colors.green);
      results.passed.push('Payload CMS API');
      return true;
    } else {
      log(`  ✗ Payload API responded with unexpected status ${response.statusCode}`, colors.red);
      results.failed.push('Payload CMS API');
      return false;
    }
  } catch (error) {
    log(`  ✗ Payload API check failed: ${error.message}`, colors.red);
    results.failed.push('Payload CMS API');
    return false;
  }
}

// Check 4: Gemini AI API
async function checkGeminiAPI() {
  log('\n[4/5] Checking Gemini AI API...', colors.blue);

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      log('  ✗ GEMINI_API_KEY environment variable not set', colors.red);
      results.failed.push('Gemini AI API');
      return false;
    }

    log(`  ✓ GEMINI_API_KEY: ${apiKey.substring(0, 8)}...`, colors.green);
    results.passed.push('Gemini AI API');
    return true;
  } catch (error) {
    log(`  ✗ Gemini API check failed: ${error.message}`, colors.red);
    results.failed.push('Gemini AI API');
    return false;
  }
}

// Check 5: Google Service Account
async function checkGoogleServiceAccount() {
  log('\n[5/5] Checking Google Service Account...', colors.blue);

  try {
    const jsonPath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH;

    if (!jsonPath) {
      log('  ✗ GOOGLE_SERVICE_ACCOUNT_JSON_PATH environment variable not set', colors.red);
      log('  ℹ Note: This check is expected to fail in Phase 0 (Human Gate)', colors.yellow);
      results.failed.push('Google Service Account');
      return false;
    }

    log(`  ✓ GOOGLE_SERVICE_ACCOUNT_JSON_PATH: ${jsonPath}`, colors.green);
    results.passed.push('Google Service Account');
    return true;
  } catch (error) {
    log(`  ✗ Google Service Account check failed: ${error.message}`, colors.red);
    results.failed.push('Google Service Account');
    return false;
  }
}

// Main validation function
async function runValidation() {
  log('\n' + '='.repeat(60), colors.bright);
  log('  PHASE 0: ENVIRONMENT & PREREQUISITE VALIDATION', colors.bright);
  log('='.repeat(60), colors.bright);

  const checks = [
    checkNodeVersion,
    checkVercelCLI,
    checkPayloadAPI,
    checkGeminiAPI,
    checkGoogleServiceAccount,
  ];

  for (const check of checks) {
    await check();
  }

  // Print summary
  log('\n' + '='.repeat(60), colors.bright);
  log('  VALIDATION SUMMARY', colors.bright);
  log('='.repeat(60), colors.bright);

  if (results.passed.length > 0) {
    log(`\n✓ PASSED (${results.passed.length}):`, colors.green);
    results.passed.forEach(check => log(`  • ${check}`, colors.green));
  }

  if (results.failed.length > 0) {
    log(`\n✗ FAILED (${results.failed.length}):`, colors.red);
    results.failed.forEach(check => log(`  • ${check}`, colors.red));
  }

  // Determine if we can proceed to Phase 2
  const criticalChecks = ['Node.js Version', 'Vercel CLI', 'Payload CMS API', 'Gemini AI API'];
  const criticalFailures = results.failed.filter(check => criticalChecks.includes(check));

  log('\n' + '='.repeat(60), colors.bright);

  if (criticalFailures.length === 0) {
    log('  ✓ VALIDATION PASSED', colors.green);
    log('  Ready to proceed to Phase 2', colors.green);
    log('='.repeat(60) + '\n', colors.bright);
    process.exit(0);
  } else {
    log('  ✗ VALIDATION FAILED', colors.red);
    log('  Cannot proceed to Phase 2', colors.red);
    log(`  Critical failures: ${criticalFailures.join(', ')}`, colors.red);
    log('='.repeat(60) + '\n', colors.bright);
    process.exit(1);
  }
}

// Run the validation
runValidation().catch(error => {
  log(`\nFatal error: ${error.message}`, colors.red);
  process.exit(1);
});
