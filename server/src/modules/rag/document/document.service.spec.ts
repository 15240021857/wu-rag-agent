import { ChunkMethod, DataScope, VectorStatus } from '@prisma/client';
import type { PrismaService } from '../../../common/prisma/prisma.service.js';
import type { AuthUser } from '../../auth/auth.types.js';
import type { KnowledgeAccessService } from '../knowledge/knowledge-access.service.js';
import {
  DOCUMENT_ACCEPTED_MESSAGE,
  DocumentService,
  type DocumentFile,
} from './document.service.js';
import type { IngestQueue } from './ingest.queue.js';

const user: AuthUser = {
  id: 'u1',
  username: 'admin',
  companyId: 'c1',
  deptId: 'd1',
  permissions: [],
  dataScope: DataScope.ALL,
};

const now = new Date('2026-01-01T00:00:00.000Z');

function markdown(name: string, text: string): DocumentFile {
  return { originalname: name, buffer: Buffer.from(text, 'utf8') };
}

function savedDocument(fileName: string, fileType: string, size: number) {
  return {
    id: 'doc1',
    knowledgeId: 'kb1',
    fileName,
    fileType,
    size,
    chunkMethod: ChunkMethod.FIXED,
    chunkSeparator: '',
    chunkSize: 4000,
    vectorStatus: VectorStatus.PROCESSING,
    ready: false,
    progress: 0,
    updatedAt: now,
    knowledge: { name: '手册' },
    _count: { chunks: 0 },
  };
}

describe('DocumentService', () => {
  function setup() {
    const prisma = {
      document: {
        count: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      knowledge: { update: vi.fn() },
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
    };
    const access = { requireReadable: vi.fn() };
    const ingestQueue = { enqueue: vi.fn(), deleteVectors: vi.fn() };
    const service = new DocumentService(
      prisma as unknown as PrismaService,
      access as unknown as KnowledgeAccessService,
      ingestQueue as unknown as IngestQueue,
    );
    return { prisma, access, ingestQueue, service };
  }

  it('stores markdown and queues ingest without writing chunks', async () => {
    const { prisma, access, ingestQueue, service } = setup();
    access.requireReadable.mockResolvedValue({ id: 'kb1', name: '手册' });
    prisma.document.create.mockResolvedValue(
      savedDocument('说明.md', 'md', Buffer.byteLength('你好')),
    );

    const result = await service.create(
      user,
      'kb1',
      markdown('说明.md', '你好'),
    );

    expect(prisma.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fileName: '说明.md',
          fileType: 'md',
          size: Buffer.byteLength('你好'),
          content: '你好',
          chunkMethod: ChunkMethod.FIXED,
          chunkSeparator: '',
          chunkSize: 4000,
          vectorStatus: VectorStatus.PROCESSING,
          ready: false,
          progress: 0,
        }),
      }),
    );
    const data = prisma.document.create.mock.calls[0]?.[0].data as {
      chunks?: unknown;
    };
    expect(data.chunks).toBeUndefined();
    expect(prisma.knowledge.update).not.toHaveBeenCalled();
    expect(ingestQueue.enqueue).toHaveBeenCalledWith('doc1');
    expect(result.message).toBe(DOCUMENT_ACCEPTED_MESSAGE);
    expect(result.data.vectorStatus).toBe(VectorStatus.PROCESSING);
    expect(result.data.ready).toBe(false);
    expect(result.data.progress).toBe(0);
    expect(result.data.chunkCount).toBe(0);
  });

  it('strips a utf-8 bom before saving', async () => {
    const { prisma, access, service } = setup();
    access.requireReadable.mockResolvedValue({ id: 'kb1', name: '手册' });
    prisma.document.create.mockResolvedValue(savedDocument('说明.md', 'md', 1));

    await service.create(user, 'kb1', {
      originalname: '说明.md',
      buffer: Buffer.concat([
        Buffer.from([0xef, 0xbb, 0xbf]),
        Buffer.from('你好'),
      ]),
    });

    expect(prisma.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ content: '你好' }),
      }),
    );
  });

  it('stores a markdown alias as md text', async () => {
    const { prisma, access, service } = setup();
    access.requireReadable.mockResolvedValue({ id: 'kb1', name: '手册' });
    prisma.document.create.mockResolvedValue(
      savedDocument('笔记.md', 'md', Buffer.byteLength('你好')),
    );

    await service.create(user, 'kb1', markdown('笔记.markdown', '你好'));

    expect(prisma.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fileName: '笔记.md',
          fileType: 'md',
          content: '你好',
        }),
      }),
    );
  });

  it('stores a pdf as base64 and lowercases the suffix', async () => {
    const { prisma, access, ingestQueue, service } = setup();
    const raw = Buffer.from('%PDF-1.4');
    access.requireReadable.mockResolvedValue({ id: 'kb1', name: '手册' });
    prisma.document.create.mockResolvedValue(
      savedDocument('条款.pdf', 'pdf', raw.length),
    );

    await service.create(user, 'kb1', {
      originalname: '条款.PDF',
      buffer: raw,
    });

    expect(prisma.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fileName: '条款.pdf',
          fileType: 'pdf',
          size: raw.length,
          content: raw.toString('base64'),
        }),
      }),
    );
    expect(ingestQueue.enqueue).toHaveBeenCalledWith('doc1');
  });

  it('rejects an unsupported file before writing', async () => {
    const { prisma, access, ingestQueue, service } = setup();
    access.requireReadable.mockResolvedValue({ id: 'kb1', name: '手册' });

    await expect(
      service.create(user, 'kb1', markdown('说明.exe', '你好')),
    ).rejects.toThrow('仅支持 txt、md、pdf、docx、xlsx、csv、ppt');
    expect(prisma.document.create).not.toHaveBeenCalled();
    expect(ingestQueue.enqueue).not.toHaveBeenCalled();
  });

  it('rejects empty markdown before writing', async () => {
    const { prisma, access, service } = setup();
    access.requireReadable.mockResolvedValue({ id: 'kb1', name: '手册' });

    await expect(
      service.create(user, 'kb1', markdown('说明.md', '  \n')),
    ).rejects.toThrow('文档内容为空');
    expect(prisma.document.create).not.toHaveBeenCalled();
  });

  it('rejects chunks that do not match the saved content', async () => {
    const { prisma, access, service } = setup();
    prisma.document.findUnique.mockResolvedValue({
      id: 'doc1',
      knowledgeId: 'kb1',
      content: '你好\n世界',
    });
    access.requireReadable.mockResolvedValue({ id: 'kb1', name: '手册' });

    await expect(
      service.revectorize(user, 'doc1', {
        chunkMethod: ChunkMethod.CHAR,
        chunkSeparator: '\\n',
        chunkSize: 100,
        chunks: [{ content: '别的内容' }],
      }),
    ).rejects.toThrow('分片与文档内容不一致');
    expect(prisma.document.update).not.toHaveBeenCalled();
  });

  it('deletes vectors before removing the document row', async () => {
    const { prisma, access, ingestQueue, service } = setup();
    prisma.document.findUnique.mockResolvedValue({
      id: 'doc1',
      knowledgeId: 'kb1',
      content: '你好',
    });
    access.requireReadable.mockResolvedValue({ id: 'kb1', name: '手册' });
    const order: string[] = [];
    ingestQueue.deleteVectors.mockImplementation(async () => {
      order.push('vectors');
    });
    prisma.document.delete.mockImplementation(async () => {
      order.push('row');
    });

    await service.remove(user, 'doc1');

    expect(order).toEqual(['vectors', 'row']);
    expect(ingestQueue.deleteVectors).toHaveBeenCalledWith('kb1', 'doc1');
    expect(prisma.document.delete).toHaveBeenCalledWith({
      where: { id: 'doc1' },
    });
    expect(prisma.knowledge.update).toHaveBeenCalledWith({
      where: { id: 'kb1' },
      data: { updatedAt: expect.any(Date) },
    });
  });

  it('keeps the document when vector deletion fails', async () => {
    const { prisma, access, ingestQueue, service } = setup();
    prisma.document.findUnique.mockResolvedValue({
      id: 'doc1',
      knowledgeId: 'kb1',
      content: '你好',
    });
    access.requireReadable.mockResolvedValue({ id: 'kb1', name: '手册' });
    ingestQueue.deleteVectors.mockRejectedValue(new Error('向量服务不可用'));

    await expect(service.remove(user, 'doc1')).rejects.toThrow('向量服务不可用');
    expect(prisma.document.delete).not.toHaveBeenCalled();
  });
});
