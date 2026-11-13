import { DataScope, KnowledgeVisibility } from '@prisma/client';
import type { PrismaService } from '../../../common/prisma/prisma.service.js';
import type { AuthUser } from '../../auth/auth.types.js';
import { KnowledgeService } from './knowledge.service.js';
import type { KnowledgeAccessService } from './knowledge-access.service.js';

const user: AuthUser = {
  id: 'u1',
  username: 'admin',
  companyId: 'c1',
  deptId: 'd1',
  permissions: [],
  dataScope: DataScope.ALL,
};

const now = new Date('2026-01-01T00:00:00.000Z');

describe('KnowledgeService', () => {
  function setup() {
    const prisma = {
      knowledge: {
        count: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    const access = { requireReadable: vi.fn() };
    const service = new KnowledgeService(
      prisma as unknown as PrismaService,
      access as unknown as KnowledgeAccessService,
    );
    return { prisma, access, service };
  }

  it('lists only knowledge the user can read', async () => {
    const { prisma, service } = setup();
    prisma.knowledge.count.mockResolvedValue(0);
    prisma.knowledge.findMany.mockResolvedValue([]);

    await service.findPage(user, { pageNum: 1, pageSize: 10, name: '手册' });

    expect(prisma.knowledge.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            expect.objectContaining({
              OR: expect.arrayContaining([
                { visibility: KnowledgeVisibility.PUBLIC },
                { ownerId: 'u1' },
              ]),
            }),
            {
              OR: [
                { name: { contains: '手册', mode: 'insensitive' } },
                { description: { contains: '手册', mode: 'insensitive' } },
              ],
            },
          ],
        },
      }),
    );
  });

  it('creates a public knowledge owned by the current user', async () => {
    const { prisma, service } = setup();
    prisma.knowledge.findFirst.mockResolvedValue(null);
    prisma.knowledge.create.mockResolvedValue({
      id: 'kb1',
      name: '产品手册',
      description: '说明',
      visibility: KnowledgeVisibility.PUBLIC,
      ownerId: 'u1',
      updatedAt: now,
      owner: { employeeName: '张三', nickname: '管理员' },
      _count: { documents: 0 },
    });

    const result = await service.create(user, {
      name: '产品手册',
      description: '说明',
    });

    expect(prisma.knowledge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          visibility: KnowledgeVisibility.PUBLIC,
          ownerId: 'u1',
        }),
      }),
    );
    expect(result.ownerName).toBe('张三');
    expect(result.documentCount).toBe(0);
  });

  it('rejects a duplicated name', async () => {
    const { prisma, service } = setup();
    prisma.knowledge.findFirst.mockResolvedValue({ id: 'other' });

    await expect(
      service.create(user, { name: '产品手册', description: '' }),
    ).rejects.toThrow('知识库名称已存在');
    expect(prisma.knowledge.create).not.toHaveBeenCalled();
  });

  it('refuses to update a knowledge the user cannot read', async () => {
    const { access, prisma, service } = setup();
    access.requireReadable.mockRejectedValue(new Error('不能修改该知识库'));

    await expect(
      service.update(user, 'kb1', { name: '新产品', description: '' }),
    ).rejects.toThrow('不能修改该知识库');
    expect(prisma.knowledge.update).not.toHaveBeenCalled();
  });
});
