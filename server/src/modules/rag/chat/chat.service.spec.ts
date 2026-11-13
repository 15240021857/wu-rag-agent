import { ConfigService } from '@nestjs/config';
import { DataScope, MessageRole } from '@prisma/client';
import type { Response } from 'express';
import type { AppConfig } from '../../../config/configuration.js';
import type { PrismaService } from '../../../common/prisma/prisma.service.js';
import type { AuthUser } from '../../auth/auth.types.js';
import type { KnowledgeAccessService } from '../knowledge/knowledge-access.service.js';
import { ChatService } from './chat.service.js';

const user: AuthUser = {
  id: 'u1',
  username: 'admin',
  companyId: 'c1',
  deptId: 'd1',
  permissions: [],
  dataScope: DataScope.ALL,
};

describe('ChatService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  function setup() {
    const prisma = {
      conversation: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
      },
      chatMessage: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      document: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const access = { requireReadable: vi.fn() };
    const config = {
      get: vi.fn(() => 'http://rag.test'),
    } as unknown as ConfigService<AppConfig, true>;
    const service = new ChatService(
      prisma as unknown as PrismaService,
      access as unknown as KnowledgeAccessService,
      config,
    );
    return { prisma, access, service };
  }

  it('forwards text and stores the answer after the stream finishes', async () => {
    const { prisma, access, service } = setup();
    access.requireReadable.mockResolvedValue({ id: 'kb1', name: '手册' });
    prisma.conversation.create.mockResolvedValue({ id: 'conv1' });
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = init.body as FormData;
      expect(body.get('query')).toBe('知识库怎么回答');
      expect(body.get('kb_id')).toBe('kb1');
      expect(body.get('system_prompt')).toBe('只根据资料回答');
      return sseResponse([
        'data: {"text":"根据"}\n\n',
        'data: {"text":"资料"}\n\n',
        'data: [DONE]\n\n',
      ]);
    });
    const res = fakeResponse();

    await service.ask(
      user,
      {
        knowledgeId: 'kb1',
        systemPrompt: '只根据资料回答',
        messages: [{ role: MessageRole.user, content: '知识库怎么回答' }],
      },
      res,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://rag.test/internal/rag/retrieve',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(res.chunks).toEqual([
      'data: {"text":"根据"}\n\n',
      'data: {"text":"资料"}\n\n',
      'data: {"conversationId":"conv1"}\n\n',
      'data: [DONE]\n\n',
    ]);
    expect(prisma.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: '知识库怎么回答',
          messages: {
            create: [
              { role: MessageRole.user, content: '知识库怎么回答', sort: 0 },
              { role: MessageRole.assistant, content: '根据资料', sort: 1 },
            ],
          },
        }),
      }),
    );
  });

  it('replaces an owned conversation without reading previous messages', async () => {
    const { prisma, access, service } = setup();
    prisma.conversation.findFirst.mockResolvedValue({ id: 'conv1' });
    access.requireReadable.mockResolvedValue({ id: 'kb1', name: '手册' });
    prisma.conversation.update.mockResolvedValue({ id: 'conv1' });
    fetchMock.mockResolvedValue(
      sseResponse(['data: {"text":"新回答"}\n\ndata: [DONE]\n\n']),
    );
    const res = fakeResponse();

    await service.ask(
      user,
      {
        conversationId: 'conv1',
        knowledgeId: 'kb1',
        systemPrompt: '',
        messages: [
          { role: MessageRole.user, content: '第一问' },
          { role: MessageRole.assistant, content: '旧回答' },
          { role: MessageRole.user, content: '再问一句' },
        ],
      },
      res,
    );

    expect(prisma.conversation.findFirst).toHaveBeenCalledWith({
      where: { id: 'conv1', userId: 'u1' },
      select: { id: true },
    });
    expect(prisma.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          messages: {
            deleteMany: {},
            create: [
              { role: MessageRole.user, content: '第一问', sort: 0 },
              { role: MessageRole.assistant, content: '旧回答', sort: 1 },
              { role: MessageRole.user, content: '再问一句', sort: 2 },
              { role: MessageRole.assistant, content: '新回答', sort: 3 },
            ],
          },
        }),
      }),
    );
    expect(res.chunks.at(-2)).toBe('data: {"conversationId":"conv1"}\n\n');
  });

  it('names citations from the knowledge documents and stores them on the answer', async () => {
    const { prisma, access, service } = setup();
    access.requireReadable.mockResolvedValue({ id: 'kb1', name: '手册' });
    prisma.conversation.create.mockResolvedValue({ id: 'conv1' });
    prisma.document.findMany.mockResolvedValue([
      { id: 'doc1', fileName: '条款.pdf' },
    ]);
    fetchMock.mockResolvedValue(
      sseResponse([
        'data: {"citations":[{"documentId":"doc1","chunkIndex":0,"content":"等待期 180 天"}]}\n\n',
        'data: {"text":"满 180 天生效[1]"}\n\n',
        'data: [DONE]\n\n',
      ]),
    );
    const res = fakeResponse();

    await service.ask(
      user,
      {
        knowledgeId: 'kb1',
        systemPrompt: '',
        messages: [{ role: MessageRole.user, content: '什么时候生效' }],
      },
      res,
    );

    const named = [
      {
        documentId: 'doc1',
        documentName: '条款.pdf',
        chunkIndex: 0,
        content: '等待期 180 天',
      },
    ];
    expect(res.chunks[0]).toBe(`data: ${JSON.stringify({ citations: named })}\n\n`);
    expect(prisma.document.findMany).toHaveBeenCalledWith({
      where: { knowledgeId: 'kb1', id: { in: ['doc1'] } },
      select: { id: true, fileName: true },
    });
    expect(prisma.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          messages: {
            create: [
              { role: MessageRole.user, content: '什么时候生效', sort: 0 },
              {
                role: MessageRole.assistant,
                content: '满 180 天生效[1]',
                sort: 1,
                citations: named,
              },
            ],
          },
        }),
      }),
    );
  });

  it('keeps citations already stored on earlier answers', async () => {
    const { prisma, access, service } = setup();
    prisma.conversation.findFirst.mockResolvedValue({ id: 'conv1' });
    access.requireReadable.mockResolvedValue({ id: 'kb1', name: '手册' });
    prisma.conversation.update.mockResolvedValue({ id: 'conv1' });
    const stored = [
      {
        documentId: 'doc1',
        documentName: '手册.md',
        chunkIndex: 0,
        content: '原文',
      },
    ];
    prisma.chatMessage.findMany.mockResolvedValue([
      { role: MessageRole.user, content: '第一问', citations: null },
      {
        role: MessageRole.assistant,
        content: '旧回答',
        citations: stored,
      },
    ]);
    fetchMock.mockResolvedValue(
      sseResponse(['data: {"text":"新回答"}\n\ndata: [DONE]\n\n']),
    );

    await service.ask(
      user,
      {
        conversationId: 'conv1',
        knowledgeId: 'kb1',
        systemPrompt: '',
        messages: [
          { role: MessageRole.user, content: '第一问' },
          { role: MessageRole.assistant, content: '旧回答' },
          { role: MessageRole.user, content: '再问一句' },
        ],
      },
      fakeResponse(),
    );

    expect(prisma.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          messages: {
            deleteMany: {},
            create: [
              { role: MessageRole.user, content: '第一问', sort: 0 },
              {
                role: MessageRole.assistant,
                content: '旧回答',
                sort: 1,
                citations: stored,
              },
              { role: MessageRole.user, content: '再问一句', sort: 2 },
              { role: MessageRole.assistant, content: '新回答', sort: 3 },
            ],
          },
        }),
      }),
    );
  });

  it('writes the upstream error and does not store the turn', async () => {
    const { prisma, access, service } = setup();
    access.requireReadable.mockResolvedValue({ id: 'kb1', name: '手册' });
    fetchMock.mockResolvedValue(
      sseResponse(['data: {"error":"模型不可用"}\n\n']),
    );

    await service.ask(
      user,
      {
        knowledgeId: 'kb1',
        systemPrompt: '',
        messages: [{ role: MessageRole.user, content: '你好' }],
      },
      fakeResponse(),
    );

    expect(prisma.conversation.create).not.toHaveBeenCalled();
  });

  it('does not reveal another user conversation', async () => {
    const { prisma, service } = setup();
    prisma.conversation.deleteMany.mockResolvedValue({ count: 0 });

    await expect(service.remove(user, 'conv-other')).rejects.toThrow(
      '对话不存在',
    );
  });
});

function sseResponse(events: string[]) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) controller.enqueue(encoder.encode(event));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

function fakeResponse() {
  let ended = false;
  const chunks: string[] = [];
  const res = {
    chunks,
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write(chunk: string) {
      chunks.push(chunk);
      return true;
    },
    end() {
      ended = true;
    },
    get writableEnded() {
      return ended;
    },
  };
  return res as typeof res & Response;
}
