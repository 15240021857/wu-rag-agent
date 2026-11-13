import { ConflictException, Injectable } from '@nestjs/common';
import { KnowledgeVisibility, Prisma } from '@prisma/client';
import {
  pageArgs,
  toPageResult,
  type PageResult,
} from '../../../common/dto/page.dto.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { rethrowPrisma } from '../../../common/utils/prisma-error.js';
import type { AuthUser } from '../../auth/auth.types.js';
import { knowledgeAccessWhere } from '../knowledge-access.js';
import {
  KnowledgePayloadDto,
  KnowledgeQueryDto,
  KnowledgeView,
} from './dto/knowledge.dto.js';
import { KnowledgeAccessService } from './knowledge-access.service.js';

const knowledgeInclude = {
  owner: { select: { employeeName: true, nickname: true } },
  _count: { select: { documents: true } },
} as const satisfies Prisma.KnowledgeInclude;

type KnowledgeRow = Prisma.KnowledgeGetPayload<{
  include: typeof knowledgeInclude;
}>;

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: KnowledgeAccessService,
  ) {}

  async findPage(
    user: AuthUser,
    query: KnowledgeQueryDto,
  ): Promise<PageResult<KnowledgeView>> {
    const where = knowledgeWhere(user, query);
    const [total, rows] = await Promise.all([
      this.prisma.knowledge.count({ where }),
      this.prisma.knowledge.findMany({
        where,
        include: knowledgeInclude,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(query),
      }),
    ]);
    return toPageResult(rows.map(toKnowledgeView), total, query);
  }

  async create(
    user: AuthUser,
    dto: KnowledgePayloadDto,
  ): Promise<KnowledgeView> {
    await this.assertName(dto.name);
    try {
      const saved = await this.prisma.knowledge.create({
        data: {
          name: dto.name,
          description: dto.description,
          visibility: KnowledgeVisibility.PUBLIC,
          ownerId: user.id,
        },
        include: knowledgeInclude,
      });
      return toKnowledgeView(saved);
    } catch (error) {
      rethrowPrisma(error);
    }
  }

  async update(
    user: AuthUser,
    id: string,
    dto: KnowledgePayloadDto,
  ): Promise<KnowledgeView> {
    await this.access.requireReadable(
      id,
      user,
      '知识库不存在',
      '不能修改该知识库',
    );
    await this.assertName(dto.name, id);
    try {
      const saved = await this.prisma.knowledge.update({
        where: { id },
        data: { name: dto.name, description: dto.description },
        include: knowledgeInclude,
      });
      return toKnowledgeView(saved);
    } catch (error) {
      rethrowPrisma(error);
    }
  }

  async remove(user: AuthUser, id: string): Promise<null> {
    await this.access.requireReadable(
      id,
      user,
      '知识库不存在',
      '不能删除该知识库',
    );
    try {
      await this.prisma.knowledge.delete({ where: { id } });
    } catch (error) {
      rethrowPrisma(error);
    }
    return null;
  }

  private async assertName(name: string, id?: string) {
    const duplicated = await this.prisma.knowledge.findFirst({
      where: { name, ...(id ? { NOT: { id } } : {}) },
      select: { id: true },
    });
    if (duplicated) throw new ConflictException('知识库名称已存在');
  }
}

function knowledgeWhere(
  user: AuthUser,
  query: KnowledgeQueryDto,
): Prisma.KnowledgeWhereInput {
  const keyword = query.name?.trim();
  return {
    AND: [
      knowledgeAccessWhere(user),
      ...(keyword
        ? [
            {
              OR: [
                { name: { contains: keyword, mode: 'insensitive' as const } },
                {
                  description: {
                    contains: keyword,
                    mode: 'insensitive' as const,
                  },
                },
              ],
            },
          ]
        : []),
    ],
  };
}

function toKnowledgeView(row: KnowledgeRow): KnowledgeView {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    visibility: row.visibility,
    ownerId: row.ownerId,
    ownerName: row.owner.employeeName || row.owner.nickname,
    documentCount: row._count.documents,
    updatedAt: row.updatedAt.toISOString(),
  };
}
