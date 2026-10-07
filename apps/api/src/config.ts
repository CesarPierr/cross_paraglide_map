/** Runtime configuration from environment variables (12-factor). */
export interface Config {
  port: number;
  host: string;
  /** postgres://… in production; `pglite:memory` or `pglite:<dir>` for local development and tests. */
  databaseUrl: string;
  /** Bearer token for moderation endpoints; moderation is disabled when empty. */
  adminToken: string;
  /** Allowed browser origins (comma separated), `*` in development. */
  corsOrigin: string[] | '*';
  /** Salt for hashing contributor IPs (never stored in clear). */
  ipSalt: string;
  /** Open-Meteo calls allowed per day (weighted: 1 call per 10 variables per location). */
  weatherDailyBudget: number;
  trustProxy: boolean;
  logLevel: string;
}

const list = (v: string | undefined) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const cors = list(env.CORS_ORIGIN);
  return {
    port: Number(env.PORT ?? 8080),
    host: env.HOST ?? '0.0.0.0',
    databaseUrl: env.DATABASE_URL ?? 'pglite:.data/dev-db',
    adminToken: env.ADMIN_TOKEN ?? '',
    corsOrigin: cors.length === 0 || cors.includes('*') ? '*' : cors,
    ipSalt: env.IP_SALT ?? 'change-me',
    weatherDailyBudget: Number(env.WEATHER_DAILY_BUDGET ?? 8000),
    trustProxy: env.TRUST_PROXY !== 'false',
    logLevel: env.LOG_LEVEL ?? 'info',
  };
}
