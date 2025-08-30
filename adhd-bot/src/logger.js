/**
 * Simple logger with timestamps
 */

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function formatTimestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, -5);
}

export function log(...args) {
  const ts = formatTimestamp();
  console.log(`${colors.cyan}[${ts}]${colors.reset}`, ...args);
}

export function info(...args) {
  const ts = formatTimestamp();
  console.log(`${colors.blue}[${ts}] INFO${colors.reset}`, ...args);
}

export function success(...args) {
  const ts = formatTimestamp();
  console.log(`${colors.green}[${ts}] ✓${colors.reset}`, ...args);
}

export function warn(...args) {
  const ts = formatTimestamp();
  console.warn(`${colors.yellow}[${ts}] ⚠ WARN${colors.reset}`, ...args);
}

export function error(...args) {
  const ts = formatTimestamp();
  console.error(`${colors.red}[${ts}] ✗ ERROR${colors.reset}`, ...args);
}

export function debug(...args) {
  if (process.env.DEBUG === 'true') {
    const ts = formatTimestamp();
    console.log(`${colors.magenta}[${ts}] DEBUG${colors.reset}`, ...args);
  }
}