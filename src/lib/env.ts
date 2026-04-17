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
  { key: 'NODE_ENV', default: 'development' },
  { key: 'LOG_LEVEL', default: '' },
] as const;

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

const supabaseUrl = process.env.SUPABASE_URL!;
if (!supabaseUrl.startsWith('https://') && !supabaseUrl.startsWith('http://')) {
  console.error(`\nInvalid SUPABASE_URL: "${supabaseUrl}" — must start with https://\n`);
  process.exit(1);
}

for (const { key, default: defaultValue } of optional) {
  if (!process.env[key] && defaultValue) {
    process.env[key] = defaultValue;
  }
}

const nodeEnv = process.env.NODE_ENV || 'development';

export const env = {
  PORT: process.env.PORT || '3001',
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  NODE_ENV: nodeEnv,
  LOG_LEVEL: process.env.LOG_LEVEL || (nodeEnv === 'production' ? 'info' : 'debug'),
  isProduction: nodeEnv === 'production',
  isDevelopment: nodeEnv === 'development',
  isTest: nodeEnv === 'test',
} as const;
