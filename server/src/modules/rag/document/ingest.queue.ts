import {
  BadGatewayException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VectorStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import type { AppConfig } from '../../../config/configuration.js';
import { documentBytes, toIngestFileName } from './chunks.js';

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

  /** 按知识库和文档 id 删除 Milvus 向量。连不上或删除失败时抛错，调用方不要继续删业务数据。 */
  async deleteVectors(knowledgeId: string, documentId: string) {
    const base = this.ragBase();
    const url = new URL(`${base}/internal/rag/deleteDocVectors`);
    url.searchParams.set('kb_id', knowledgeId);
    url.searchParams.set('doc_id', documentId);
    let response: Response;
    try {
      response = await fetch(url, { method: 'DELETE' });
    } catch (error) {
      this.logger.error(error);
      throw new BadGatewayException('向量服务不可用');
    }
    await response.arrayBuffer().catch(() => undefined);
    if (!response.ok) {
      this.logger.error(`delete vectors failed: ${response.status}`);
      throw new BadGatewayException('向量删除失败');
    }
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
        fileType: true,
        content: true,
        vectorStatus: true,
      },
    });
    if (!current || current.vectorStatus !== VectorStatus.PROCESSING) return;

    const base = this.ragBase();
    const fileName = toIngestFileName(current.fileName);
    // 二进制在库里是 base64，这里还原成原文件再交给 Python。
    const bytes = documentBytes(current.fileType, current.content);
    const body = new FormData();
    body.set(
      'file',
      new File([new Uint8Array(bytes)], fileName, {
        type: contentTypeOf(current.fileType),
      }),
    );
    body.set('name', fileName);
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

    // 请求发出后文档可能已被删除，这时向量刚写进去，要再清一次。
    const stillThere = await this.prisma.document.findUnique({
      where: { id: current.id },
      select: { id: true },
    });
    if (!stillThere) {
      await this.deleteVectors(current.knowledgeId, current.id).catch(
        (error: unknown) => {
          this.logger.error(error);
        },
      );
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

  private ragBase() {
    return this.config.get('ragBaseUrl', { infer: true }).replace(/\/$/, '');
  }
}

const CONTENT_TYPES: Record<string, string> = {
  txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv; charset=utf-8',
  ppt: 'application/vnd.ms-powerpoint',
};

function contentTypeOf(fileType: string) {
  return CONTENT_TYPES[fileType] ?? 'application/octet-stream';
}
