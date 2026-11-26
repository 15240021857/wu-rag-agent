import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChunkMethod, Prisma, VectorStatus } from '@prisma/client';
import {
  pageArgs,
  toPageResult,
  type PageResult,
} from '../../../common/dto/page.dto.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { rethrowPrisma } from '../../../common/utils/prisma-error.js';
import type { AuthUser } from '../../auth/auth.types.js';
import { KnowledgeAccessService } from '../knowledge/knowledge-access.service.js';
import { knowledgeAccessWhere } from '../knowledge-access.js';
import {
  assertChunks,
  isBinaryFileType,
  normalizeUploadName,
  separatorOf,
  type ChunkDraft,
} from './chunks.js';
import { IngestQueue } from './ingest.queue.js';
import {
  ChunkSettingsDto,
  DocumentDetailView,
  DocumentQueryDto,
  DocumentView,
} from './dto/document.dto.js';

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_ACCEPTED_MESSAGE = '上传完成，等待向量化';

/** multer 交给业务层的上传文件，二进制和文本都先留在 buffer 里。 */
export interface DocumentFile {
  originalname: string;
  buffer: Buffer;
}

const documentInclude = {
  knowledge: { select: { name: true } },
  _count: { select: { chunks: true } },
} as const satisfies Prisma.DocumentInclude;

const documentDetailInclude = {
  knowledge: { select: { name: true } },
  _count: { select: { chunks: true } },
  chunks: { orderBy: { index: 'asc' as const } },
} as const satisfies Prisma.DocumentInclude;

type DocumentRow = Prisma.DocumentGetPayload<{
  include: typeof documentInclude;
}>;
type DocumentDetailRow = Prisma.DocumentGetPayload<{
  include: typeof documentDetailInclude;
}>;

/** 重新入库这次仍直接标记就绪，不调用 Python。 */
const readyNow = {
  vectorStatus: VectorStatus.READY,
  ready: true,
  progress: 100,
} as const;

@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: KnowledgeAccessService,
    private readonly ingestQueue: IngestQueue,
  ) {}

  async findPage(
    user: AuthUser,
    query: DocumentQueryDto,
  ): Promise<PageResult<DocumentView>> {
    const where = documentWhere(user, query);
    const [total, rows] = await Promise.all([
      this.prisma.document.count({ where }),
      this.prisma.document.findMany({
        where,
        include: documentInclude,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(query),
      }),
    ]);
    return toPageResult(rows.map(toDocumentView), total, query);
  }

  async findOne(user: AuthUser, id: string): Promise<DocumentView> {
    const current = await this.requireDocument(id);
    await this.access.requireReadable(
      current.knowledgeId,
      user,
      '知识库不存在',
      '不能查看该文档',
    );
    const row = await this.prisma.document.findUniqueOrThrow({
      where: { id },
      include: documentInclude,
    });
    return toDocumentView(row);
  }

  async findDetail(user: AuthUser, id: string): Promise<DocumentDetailView> {
    const current = await this.requireDocument(id);
    await this.access.requireReadable(
      current.knowledgeId,
      user,
      '知识库不存在',
      '不能查看该文档',
    );
    const row = await this.prisma.document.findUniqueOrThrow({
      where: { id },
      include: documentDetailInclude,
    });
    return toDocumentDetail(row);
  }

  async create(
    user: AuthUser,
    knowledgeId: string,
    file: DocumentFile | undefined,
  ): Promise<{ message: string; data: DocumentView }> {
    const knowledge = await this.access.requireReadable(
      knowledgeId,
      user,
      '请选择知识库',
      '不能向该知识库添加文档',
    );
    if (!file?.buffer) throw new BadRequestException('请上传文档');
    if (file.buffer.length === 0) throw new BadRequestException('文档内容为空');
    if (file.buffer.length > MAX_DOCUMENT_BYTES) {
      throw new BadRequestException('文件过大');
    }
    const { fileName, fileType } = normalizeUploadName(file.originalname);
    // 文本存原文，方便预览；二进制先存 base64，等以后换云存储再改成对象键。
    const content = isBinaryFileType(fileType)
      ? file.buffer.toString('base64')
      : decodeText(file.buffer);
    try {
      const saved = await this.prisma.$transaction(async (tx) => {
        return tx.document.create({
          data: {
            knowledgeId: knowledge.id,
            fileName,
            fileType,
            size: file.buffer.length,
            content,
            chunkMethod: ChunkMethod.FIXED,
            chunkSeparator: '',
            chunkSize: 4000,
            vectorStatus: VectorStatus.PROCESSING,
            ready: false,
            progress: 0,
          },
          include: documentInclude,
        });
      });
      this.ingestQueue.enqueue(saved.id);
      return {
        message: DOCUMENT_ACCEPTED_MESSAGE,
        data: toDocumentView(saved),
      };
    } catch (error) {
      rethrowPrisma(error);
    }
  }

  async revectorize(
    user: AuthUser,
    id: string,
    dto: ChunkSettingsDto,
  ): Promise<DocumentView> {
    const current = await this.requireDocument(id);
    const knowledge = await this.access.requireReadable(
      current.knowledgeId,
      user,
      '知识库不存在',
      '不能重新向量化该文档',
    );
    const chunks = dto.chunks.map((item) => item.content);
    const draft = chunkDraft(dto, chunks);
    assertChunks(current.content, draft);
    try {
      const saved = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.document.update({
          where: { id },
          data: {
            chunkMethod: dto.chunkMethod,
            chunkSeparator: separatorOf(draft),
            chunkSize: dto.chunkSize,
            ...readyNow,
            chunks: {
              deleteMany: {},
              create: toChunkRows(chunks),
            },
          },
          include: documentInclude,
        });
        await tx.knowledge.update({
          where: { id: knowledge.id },
          data: { updatedAt: new Date() },
        });
        return updated;
      });
      return toDocumentView(saved);
    } catch (error) {
      rethrowPrisma(error);
    }
  }

  async remove(user: AuthUser, id: string): Promise<null> {
    const current = await this.requireDocument(id);
    await this.access.requireReadable(
      current.knowledgeId,
      user,
      '知识库不存在',
      '不能删除该文档',
    );
    // 先删向量。失败就保留文档，用户可以再删一次。
    await this.ingestQueue.deleteVectors(current.knowledgeId, id);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.document.delete({ where: { id } });
        await tx.knowledge.update({
          where: { id: current.knowledgeId },
          data: { updatedAt: new Date() },
        });
      });
    } catch (error) {
      rethrowPrisma(error);
    }
    return null;
  }

  private async requireDocument(id: string) {
    const current = await this.prisma.document.findUnique({
      where: { id },
      select: { id: true, knowledgeId: true, content: true },
    });
    if (!current) throw new NotFoundException('文档不存在');
    return current;
  }
}

function decodeText(buffer: Buffer) {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new BadRequestException('文档编码需为 UTF-8');
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (!text.trim()) throw new BadRequestException('文档内容为空');
  return text;
}

function documentWhere(
  user: AuthUser,
  query: DocumentQueryDto,
): Prisma.DocumentWhereInput {
  const fileName = query.fileName?.trim();
  return {
    knowledge: knowledgeAccessWhere(user),
    ...(query.knowledgeId ? { knowledgeId: query.knowledgeId } : {}),
    ...(fileName
      ? { fileName: { contains: fileName, mode: 'insensitive' } }
      : {}),
    ...(query.vectorStatus ? { vectorStatus: query.vectorStatus } : {}),
  };
}

function toChunkRows(chunks: string[]) {
  return chunks.map((content, index) => ({
    index: index + 1,
    content,
    charCount: content.length,
  }));
}

function chunkDraft(dto: ChunkSettingsDto, chunks: string[]): ChunkDraft {
  return {
    chunkMethod: dto.chunkMethod,
    chunkSeparator: dto.chunkSeparator,
    chunkSize: dto.chunkSize,
    chunks,
  };
}

function toDocumentFields(row: DocumentRow) {
  return {
    id: row.id,
    knowledgeId: row.knowledgeId,
    knowledgeName: row.knowledge.name,
    fileName: row.fileName,
    fileType: row.fileType,
    size: row.size,
    chunkMethod: row.chunkMethod,
    chunkSeparator: row.chunkSeparator,
    chunkSize: row.chunkSize,
    chunkCount: row._count.chunks,
    vectorStatus: row.vectorStatus,
    ready: row.ready,
    progress: row.progress,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDocumentView(row: DocumentRow): DocumentView {
  return toDocumentFields(row);
}

function toDocumentDetail(row: DocumentDetailRow): DocumentDetailView {
  return {
    ...toDocumentFields(row),
    content: row.content,
    chunks: row.chunks.map((item) => ({
      index: item.index,
      content: item.content,
      charCount: item.charCount,
    })),
  };
}
