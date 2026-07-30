import dotenv from 'dotenv';
dotenv.config();

export function validateEnv(): void {
  const missingVars: string[] = [];

  const jwtAccess = process.env.JWT_ACCESS_SECRET;
  const jwtRefresh = process.env.JWT_REFRESH_SECRET;

  if (!jwtAccess || jwtAccess === 'fallback-secret-key') {
    missingVars.push('JWT_ACCESS_SECRET');
  }

  if (!jwtRefresh || jwtRefresh === 'fallback-refresh-secret-key') {
    missingVars.push('JWT_REFRESH_SECRET');
  }

  if (missingVars.length > 0) {
    console.error('FATAL ENVIRONMENT CONFIGURATION ERROR:');
    missingVars.forEach((v) => console.error(`  - Missing or insecure environment variable: ${v}`));
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.warn('WARNING: Server running in development mode with incomplete environment variables.');
    }
  }
}
