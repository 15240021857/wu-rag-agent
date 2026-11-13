import { Status, type Company } from '@prisma/client';
import { CompanyService } from './company.service.js';
import type { CompanyPayloadDto } from './dto/company.dto.js';
import type { PrismaService } from '../../../common/prisma/prisma.service.js';

const now = new Date('2026-01-01T00:00:00.000Z');

function company(
  partial: Pick<Company, 'id' | 'name' | 'code' | 'parentId'> &
    Partial<Company>,
): Company {
  return {
    sort: 1,
    leader: '',
    phone: '',
    address: '',
    status: Status.NORMAL,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

function payload(partial: Partial<CompanyPayloadDto> = {}): CompanyPayloadDto {
  return {
    name: '研发',
    code: 'rd',
    parentId: null,
    sort: 1,
    leader: '',
    phone: '',
    address: '',
    status: Status.NORMAL,
    ...partial,
  };
}

describe('CompanyService', () => {
  function setup() {
    const prisma = {
      company: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      dept: { count: vi.fn() },
      user: { count: vi.fn() },
    };
    const service = new CompanyService(prisma as unknown as PrismaService);
    return { prisma, service };
  }

  it('returns a tree and keeps ancestors of a name match', async () => {
    const { prisma, service } = setup();
    prisma.company.findMany.mockResolvedValue([
      company({
        id: 'c1',
        name: '集团',
        code: 'root',
        parentId: null,
        sort: 1,
      }),
      company({ id: 'c2', name: '研发', code: 'rd', parentId: 'c1', sort: 1 }),
      company({
        id: 'c3',
        name: '销售',
        code: 'sales',
        parentId: 'c1',
        sort: 2,
        status: Status.DISABLED,
      }),
    ]);

    const page = await service.findPage({
      pageNum: 1,
      pageSize: 500,
      name: '研发',
    });

    expect(page.total).toBe(2);
    expect(page.list.map((item) => item.id)).toEqual(['c1']);
    expect(page.list[0].children?.map((item) => item.id)).toEqual(['c2']);
    expect(page.list[0].updatedAt).toBe(now.toISOString());
  });

  it('rejects a parent that is a descendant', async () => {
    const { prisma, service } = setup();
    prisma.company.findUnique
      .mockResolvedValueOnce(
        company({ id: 'c1', name: '集团', code: 'root', parentId: null }),
      )
      .mockResolvedValueOnce(
        company({ id: 'c2', name: '研发', code: 'rd', parentId: 'c1' }),
      );
    prisma.company.findMany.mockResolvedValue([
      { id: 'c1', parentId: null },
      { id: 'c2', parentId: 'c1' },
    ]);

    await expect(
      service.update('c1', payload({ parentId: 'c2' })),
    ).rejects.toThrow('上级公司不能是自己或下级公司');
  });

  it('blocks deletion while departments still exist', async () => {
    const { prisma, service } = setup();
    prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.company.count.mockResolvedValue(0);
    prisma.dept.count.mockResolvedValue(1);
    prisma.user.count.mockResolvedValue(0);

    await expect(service.remove('c1')).rejects.toThrow('请先删除公司下的部门');
    expect(prisma.company.delete).not.toHaveBeenCalled();
  });
});
