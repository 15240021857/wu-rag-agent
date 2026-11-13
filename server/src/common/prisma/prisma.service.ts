import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const localDatabaseUrl =
  'postgresql://postgres:postgres@127.0.0.1:5432/wu_rag?schema=public';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = localDatabaseUrl;
    }
    super();
  }

  // Connects on the first query so the API can boot before PostgreSQL is up.
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
