import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VectorStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import type { AppConfig } from '../../../config/configuration.js';

@Injectable()
export class IngestQueue implements OnModuleInit {
  private readonly logger = new Logger(IngestQueue.name);
  private readonly pending: string[] = [];
  private readonly queued = new Set<string>();
  private pump: Promise<void> = Promise.resolve();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async onModuleInit() {
    const rows = await this.prisma.document.findMany({
      where: { vectorStatus: VectorStatus.PROCESSING },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    for (const row of rows) this.enqueue(row.id);
  }

  enqueue(documentId: string) {
    if (this.queued.has(documentId)) return;
    this.queued.add(documentId);
    this.pending.push(documentId);
    this.pump = this.pump
      .catch((error: unknown) => {
        this.logger.error(error);
      })
      .then(() => this.runNext());
  }

  whenIdle(): Promise<void> {
    return this.pump;
  }

  private async runNext() {
    const id = this.pending.shift();
    if (!id) return;
    try {
      await this.ingest(id);
    } catch (error) {
      this.logger.error(error);
    } finally {
      this.queued.delete(id);
    }
  }

  private async ingest(id: string) {
    const current = await this.prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        knowledgeId: true,
        fileName: true,
        content: true,
        vectorStatus: true,
      },
    });
    if (!current || current.vectorStatus !== VectorStatus.PROCESSING) return;

    const base = this.config
      .get('ragBaseUrl', { infer: true })
      .replace(/\/$/, '');
    const body = new FormData();
    const bytes = Buffer.from(current.content, 'utf8');
    body.set(
      'file',
      new File([bytes], current.fileName, { type: 'text/markdown' }),
    );
    body.set('name', current.fileName);
    body.set('kb_id', current.knowledgeId);
    body.set('doc_id', current.id);

    let response: Response;
    try {
      response = await fetch(`${base}/internal/rag/ingestDocFile`, {
        method: 'POST',
        body,
      });
    } catch (error) {
      this.logger.error(error);
      await this.markFailed(current.id);
      return;
    }
    await response.arrayBuffer().catch(() => undefined);
    if (!response.ok) {
      this.logger.error(`ingest failed: ${response.status}`);
      await this.markFailed(current.id);
      return;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.document.update({
          where: { id: current.id },
          data: {
            vectorStatus: VectorStatus.READY,
            ready: true,
            progress: 100,
          },
        });
        await tx.knowledge.update({
          where: { id: current.knowledgeId },
          data: { updatedAt: new Date() },
        });
      });
    } catch (error) {
      this.logger.error(error);
      await this.markFailed(current.id);
    }
  }

  private async markFailed(id: string) {
    try {
      await this.prisma.document.update({
        where: { id },
        data: {
          vectorStatus: VectorStatus.FAILED,
          ready: false,
          progress: 0,
        },
      });
    } catch (error) {
      this.logger.error(error);
    }
  }
}
