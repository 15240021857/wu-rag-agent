import { ConfigService } from '@nestjs/config';
import { VectorStatus } from '@prisma/client';
import type { AppConfig } from '../../../config/configuration.js';
import type { PrismaService } from '../../../common/prisma/prisma.service.js';
import { IngestQueue } from './ingest.queue.js';

describe('IngestQueue', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  function setup() {
    const docs = new Map<
      string,
      {
        id: string;
        knowledgeId: string;
        fileName: string;
        content: string;
        vectorStatus: VectorStatus;
      }
    >();
    const prisma = {
      document: {
        findMany: vi.fn(),
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          return docs.get(where.id) ?? null;
        }),
        update: vi.fn(),
      },
      knowledge: { update: vi.fn() },
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
    };
    const config = {
      get: vi.fn(() => 'http://rag.test/'),
    } as unknown as ConfigService<AppConfig, true>;
    const queue = new IngestQueue(prisma as unknown as PrismaService, config);
    return { prisma, docs, queue };
  }

  function processing(id: string, content: string) {
    return {
      id,
      knowledgeId: 'kb1',
      fileName: `${id}.md`,
      content,
      vectorStatus: VectorStatus.PROCESSING,
    };
  }

  it('marks the document ready after Python accepts the file', async () => {
    const { prisma, docs, queue } = setup();
    docs.set('doc1', processing('doc1', '# 标题'));
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      expect(url).toBe('http://rag.test/internal/rag/ingestDocFile');
      const body = init.body as FormData;
      expect(body.get('name')).toBe('doc1.md');
      expect(body.get('kb_id')).toBe('kb1');
      expect(body.get('doc_id')).toBe('doc1');
      const file = body.get('file');
      expect(file).toBeInstanceOf(File);
      expect((file as File).name).toBe('doc1.md');
      expect(await (file as File).text()).toBe('# 标题');
      return new Response('{}', { status: 200 });
    });

    queue.enqueue('doc1');
    await queue.whenIdle();

    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'doc1' },
      data: {
        vectorStatus: VectorStatus.READY,
        ready: true,
        progress: 100,
      },
    });
    expect(prisma.knowledge.update).toHaveBeenCalledWith({
      where: { id: 'kb1' },
      data: { updatedAt: expect.any(Date) },
    });
  });

  it('marks the document failed when Python is unavailable and continues', async () => {
    const { prisma, docs, queue } = setup();
    docs.set('a', processing('a', '甲'));
    docs.set('b', processing('b', '乙'));
    fetchMock
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    queue.enqueue('a');
    queue.enqueue('b');
    await queue.whenIdle();

    expect(prisma.document.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'a' },
      data: {
        vectorStatus: VectorStatus.FAILED,
        ready: false,
        progress: 0,
      },
    });
    expect(prisma.document.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'b' },
      data: {
        vectorStatus: VectorStatus.READY,
        ready: true,
        progress: 100,
      },
    });
    expect(prisma.knowledge.update).toHaveBeenCalledTimes(1);
  });

  it('requeues documents still processing when the module starts', async () => {
    const { prisma, docs, queue } = setup();
    docs.set('a', processing('a', '甲'));
    docs.set('b', processing('b', '乙'));
    prisma.document.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    const seen: string[] = [];
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const docId = (init.body as FormData).get('doc_id');
      if (typeof docId !== 'string') throw new Error('缺少 doc_id');
      seen.push(docId);
      return new Response(null, { status: 503 });
    });

    await queue.onModuleInit();
    await queue.whenIdle();

    expect(prisma.document.findMany).toHaveBeenCalledWith({
      where: { vectorStatus: VectorStatus.PROCESSING },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    expect(seen).toEqual(['a', 'b']);
    expect(prisma.document.update).toHaveBeenCalledTimes(2);
    expect(prisma.knowledge.update).not.toHaveBeenCalled();
  });
});
