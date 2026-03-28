/**
 * Validates all required environment variables at startup.
 * Fails fast with a clear message listing ALL missing vars.
 * Import this module early (before anything else uses process.env).
 */

const required = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

const optional = [
  { key: 'PORT', default: '3001' },
  { key: 'CORS_ORIGIN', default: 'http://localhost:3000' },
] as const;

// Collect all missing required vars
const missing = required.filter((key) => !process.env[key]?.trim());

if (missing.length > 0) {
  console.error('\n========================================');
  console.error('  MISSING REQUIRED ENVIRONMENT VARIABLES');
  console.error('========================================');
  for (const key of missing) {
    console.error(`  - ${key}`);
  }
  console.error('\nCreate a .env file in the project root.');
  console.error('See .env.example for the template.\n');
  process.exit(1);
}

// Validate format
const supabaseUrl = process.env.SUPABASE_URL!;
if (!supabaseUrl.startsWith('https://') && !supabaseUrl.startsWith('http://')) {
  console.error(`\nInvalid SUPABASE_URL: "${supabaseUrl}" — must start with https://\n`);
  process.exit(1);
}

// Apply defaults to optional vars
for (const { key, default: defaultValue } of optional) {
  if (!process.env[key]) {
    process.env[key] = defaultValue;
  }
}

// Export typed env for use across the codebase
export const env = {
  PORT: process.env.PORT || '3001',
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
} as const;
