import { Status } from '@prisma/client';
import type { PrismaService } from '../../../common/prisma/prisma.service.js';
import { DeptService } from './dept.service.js';
import type { DeptPayloadDto } from './dto/dept.dto.js';

function payload(partial: Partial<DeptPayloadDto> = {}): DeptPayloadDto {
  return {
    name: '研发',
    code: 'rd',
    companyId: 'c1',
    parentId: 'p1',
    sort: 1,
    leader: '',
    status: Status.NORMAL,
    ...partial,
  };
}

describe('DeptService', () => {
  function setup() {
    const prisma = {
      dept: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      company: { findUnique: vi.fn() },
      user: { count: vi.fn() },
      knowledgeDept: { count: vi.fn() },
    };
    const service = new DeptService(prisma as unknown as PrismaService);
    return { prisma, service };
  }

  it('rejects a parent department from another company', async () => {
    const { prisma, service } = setup();
    prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.dept.findUnique.mockResolvedValue({ id: 'p1', companyId: 'c2' });

    await expect(service.create(payload())).rejects.toThrow(
      '上级部门必须属于同一公司',
    );
  });

  it('blocks deletion while users still belong to the department', async () => {
    const { prisma, service } = setup();
    prisma.dept.findUnique.mockResolvedValue({ id: 'd1' });
    prisma.dept.count.mockResolvedValue(0);
    prisma.user.count.mockResolvedValue(2);
    prisma.knowledgeDept.count.mockResolvedValue(0);

    await expect(service.remove('d1')).rejects.toThrow('请先删除部门下的用户');
  });
});
