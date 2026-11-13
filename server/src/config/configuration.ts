export interface AppConfig {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  ragBaseUrl: string;
}

export function configuration(): AppConfig {
  const parsedPort = Number(process.env.PORT ?? 3000);

  return {
    port: Number.isFinite(parsedPort) ? parsedPort : 3000,
    databaseUrl: process.env.DATABASE_URL ?? '',
    jwtSecret: process.env.JWT_SECRET ?? '',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
    ragBaseUrl: process.env.RAG_BASE_URL ?? 'http://127.0.0.1:8001',
  };
}
