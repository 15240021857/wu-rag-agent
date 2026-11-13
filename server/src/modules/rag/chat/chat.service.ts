import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageRole, Prisma } from '@prisma/client';
import type { Response } from 'express';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { rethrowPrisma } from '../../../common/utils/prisma-error.js';
import type { AppConfig } from '../../../config/configuration.js';
import type { AuthUser } from '../../auth/auth.types.js';
import { KnowledgeAccessService } from '../knowledge/knowledge-access.service.js';
import {
  ChatPayloadDto,
  CitationView,
  ConversationDetailView,
  ConversationSummaryView,
} from './dto/chat.dto.js';
import { readSse, type IncomingCitation, type SsePiece } from './retrieve.js';

const summaryInclude = {
  knowledge: { select: { name: true } },
} as const satisfies Prisma.ConversationInclude;

const detailInclude = {
  knowledge: { select: { name: true } },
  messages: { orderBy: { sort: 'asc' as const } },
} as const satisfies Prisma.ConversationInclude;

type SummaryRow = Prisma.ConversationGetPayload<{
  include: typeof summaryInclude;
}>;
type DetailRow = Prisma.ConversationGetPayload<{
  include: typeof detailInclude;
}>;

interface StoredMessage {
  role: MessageRole;
  content: string;
  citations?: Prisma.InputJsonValue;
}

interface PriorMessage {
  role: MessageRole;
  content: string;
  citations: Prisma.JsonValue | null;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: KnowledgeAccessService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async list(user: AuthUser): Promise<ConversationSummaryView[]> {
    const rows = await this.prisma.conversation.findMany({
      where: { userId: user.id },
      include: summaryInclude,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(toSummary);
  }

  async findOne(user: AuthUser, id: string): Promise<ConversationDetailView> {
    const row = await this.prisma.conversation.findFirst({
      where: { id, userId: user.id },
      include: detailInclude,
    });
    if (!row) throw new NotFoundException('对话不存在');
    return toDetail(row);
  }

  async remove(user: AuthUser, id: string): Promise<null> {
    const removed = await this.prisma.conversation.deleteMany({
      where: { id, userId: user.id },
    });
    if (!removed.count) throw new NotFoundException('对话不存在');
    return null;
  }

  async ask(user: AuthUser, dto: ChatPayloadDto, res: Response): Promise<void> {
    await this.requireOwned(user.id, dto.conversationId);
    const knowledge = await this.access.requireReadable(
      dto.knowledgeId,
      user,
      '请选择知识库',
      '不能使用该知识库',
    );
    const history = dto.messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));
    const latest = history[history.length - 1];
    if (!latest || latest.role !== MessageRole.user || !latest.content.trim()) {
      throw new BadRequestException('请输入问题');
    }

    const upstream = await this.openRetrieve(
      latest.content.trim(),
      knowledge.id,
      dto.systemPrompt,
    );
    this.startSse(res);

    const reader = upstream.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    let answer = '';
    let citations: CitationView[] = [];
    try {
      while (true) {
        const { done, value } = await reader.read();
        pending += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const parsed = readSse(pending);
        pending = parsed.rest;
        const forwarded = await this.forwardPieces(
          res,
          user,
          dto,
          knowledge.id,
          history,
          parsed.pieces,
          answer,
          citations,
        );
        answer = forwarded.answer;
        citations = forwarded.citations;
        if (forwarded.finished) return;
        if (done) break;
      }
      this.writeSse(res, JSON.stringify({ error: '检索未完成' }));
    } catch (error) {
      this.logger.error(error);
      this.writeSse(res, JSON.stringify({ error: '检索服务不可用' }));
    } finally {
      reader.releaseLock();
      this.endSse(res);
    }
  }

  private async requireOwned(userId: string, conversationId?: string) {
    if (!conversationId) return;
    const existing = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('对话不存在');
  }

  private async openRetrieve(
    query: string,
    kbId: string,
    systemPrompt: string,
  ): Promise<ReadableStream<Uint8Array>> {
    const base = this.config
      .get('ragBaseUrl', { infer: true })
      .replace(/\/$/, '');
    const body = new FormData();
    body.set('query', query);
    body.set('kb_id', kbId);
    body.set('system_prompt', systemPrompt);
    let response: globalThis.Response;
    try {
      response = await fetch(`${base}/internal/rag/retrieve`, {
        method: 'POST',
        body,
      });
    } catch (error) {
      this.logger.error(error);
      throw new BadGatewayException('检索服务不可用');
    }
    if (!response.ok || !response.body) {
      throw new BadGatewayException('检索服务不可用');
    }
    return response.body;
  }

  private startSse(res: Response) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
  }

  private async forwardPieces(
    res: Response,
    user: AuthUser,
    dto: ChatPayloadDto,
    knowledgeId: string,
    history: StoredMessage[],
    pieces: SsePiece[],
    answer: string,
    citations: CitationView[],
  ) {
    let next = answer;
    let named = citations;
    for (const piece of pieces) {
      if (piece.kind === 'text') {
        next += piece.text;
        this.writeSse(res, JSON.stringify({ text: piece.text }));
        continue;
      }
      if (piece.kind === 'citations') {
        named = await this.nameCitations(knowledgeId, piece.citations);
        if (named.length) {
          this.writeSse(res, JSON.stringify({ citations: named }));
        }
        continue;
      }
      if (piece.kind === 'error') {
        this.writeSse(res, JSON.stringify({ error: piece.message }));
        return { answer: next, citations: named, finished: true };
      }
      await this.finish(res, user, dto, knowledgeId, history, next, named);
      return { answer: next, citations: named, finished: true };
    }
    return { answer: next, citations: named, finished: false };
  }

  private async nameCitations(
    knowledgeId: string,
    items: IncomingCitation[],
  ): Promise<CitationView[]> {
    const ids = [
      ...new Set(items.map((item) => item.documentId).filter((id) => id.length > 0)),
    ];
    const docs = ids.length
      ? await this.prisma.document.findMany({
          where: { knowledgeId, id: { in: ids } },
          select: { id: true, fileName: true },
        })
      : [];
    const names = new Map(docs.map((doc) => [doc.id, doc.fileName]));
    return items.map((item) => ({
      documentId: item.documentId,
      documentName: names.get(item.documentId) ?? '未命名文档',
      chunkIndex: item.chunkIndex,
      content: item.content,
    }));
  }

  private async finish(
    res: Response,
    user: AuthUser,
    dto: ChatPayloadDto,
    knowledgeId: string,
    history: StoredMessage[],
    answer: string,
    citations: CitationView[],
  ) {
    try {
      const id = await this.persist(user.id, dto, knowledgeId, [
        ...history,
        {
          role: MessageRole.assistant,
          content: answer,
          ...(citations.length ? { citations: toCitationJson(citations) } : {}),
        },
      ]);
      this.writeSse(res, JSON.stringify({ conversationId: id }));
      this.writeSse(res, '[DONE]');
    } catch (error) {
      this.logger.error(error);
      this.writeSse(res, JSON.stringify({ error: '保存对话失败' }));
    }
  }

  private async persist(
    userId: string,
    dto: ChatPayloadDto,
    knowledgeId: string,
    history: StoredMessage[],
  ): Promise<string> {
    const previous = dto.conversationId
      ? await this.prisma.chatMessage.findMany({
          where: { conversationId: dto.conversationId },
          orderBy: { sort: 'asc' },
          select: { role: true, content: true, citations: true },
        })
      : [];
    const rows = toMessageRows(history, previous);
    try {
      if (dto.conversationId) {
        const saved = await this.prisma.conversation.update({
          where: { id: dto.conversationId },
          data: {
            knowledgeId,
            systemPrompt: dto.systemPrompt,
            messages: {
              deleteMany: {},
              create: rows,
            },
          },
          select: { id: true },
        });
        return saved.id;
      }
      const saved = await this.prisma.conversation.create({
        data: {
          userId,
          knowledgeId,
          title: conversationTitle(history),
          systemPrompt: dto.systemPrompt,
          messages: { create: rows },
        },
        select: { id: true },
      });
      return saved.id;
    } catch (error) {
      rethrowPrisma(error);
    }
  }

  private writeSse(res: Response, data: string) {
    if (res.writableEnded) return;
    res.write(`data: ${data}\n\n`);
  }

  private endSse(res: Response) {
    if (res.writableEnded) return;
    res.end();
  }
}

function conversationTitle(history: StoredMessage[]) {
  const firstUser =
    history.find((item) => item.role === MessageRole.user)?.content.trim() ||
    '新对话';
  return firstUser.slice(0, 24);
}

function toMessageRows(
  history: StoredMessage[],
  previous: PriorMessage[],
): Prisma.ChatMessageCreateWithoutConversationInput[] {
  return history.map((message, sort) => {
    const citations = carriedCitations(previous[sort], message);
    return {
      role: message.role,
      content: message.content,
      sort,
      ...(citations ? { citations } : {}),
    };
  });
}

function carriedCitations(
  prior: PriorMessage | undefined,
  message: StoredMessage,
): Prisma.InputJsonValue | undefined {
  if (message.citations !== undefined) return message.citations;
  if (!prior || prior.role !== message.role || prior.content !== message.content) {
    return undefined;
  }
  if (!Array.isArray(prior.citations) || !prior.citations.length) return undefined;
  return prior.citations;
}

function toCitationJson(citations: CitationView[]): Prisma.InputJsonValue {
  return citations.map((item) => ({
    documentId: item.documentId,
    documentName: item.documentName,
    chunkIndex: item.chunkIndex,
    content: item.content,
  }));
}

function toSummaryFields(row: SummaryRow) {
  return {
    id: row.id,
    title: row.title,
    knowledgeId: row.knowledgeId,
    knowledgeName: row.knowledge.name,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSummary(row: SummaryRow): ConversationSummaryView {
  return toSummaryFields(row);
}

function toDetail(row: DetailRow): ConversationDetailView {
  const summary = toSummaryFields(row);
  return {
    ...summary,
    systemPrompt: row.systemPrompt,
    messages: row.messages.map((message) => {
      const citations = readCitations(message.citations);
      return {
        role: message.role,
        content: message.content,
        ...(citations ? { citations } : {}),
      };
    }),
  };
}

function readCitations(
  value: Prisma.JsonValue | null,
): CitationView[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const citations: CitationView[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    if (
      typeof item.documentId !== 'string' ||
      typeof item.documentName !== 'string' ||
      typeof item.chunkIndex !== 'number' ||
      typeof item.content !== 'string'
    ) {
      continue;
    }
    citations.push({
      documentId: item.documentId,
      documentName: item.documentName,
      chunkIndex: item.chunkIndex,
      content: item.content,
    });
  }
  return citations.length ? citations : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
