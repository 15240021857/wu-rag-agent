import { Status } from '@prisma/client';
import type { PrismaService } from '../../../common/prisma/prisma.service.js';
import type { CreateUserDto } from './dto/user.dto.js';
import { UserService } from './user.service.js';

vi.mock('../../../common/utils/password.js', () => ({
  hashPassword: vi.fn((password: string) =>
    Promise.resolve(`hashed:${password}`),
  ),
}));

const now = new Date('2026-01-01T00:00:00.000Z');

function payload(): CreateUserDto {
  return {
    username: 'admin',
    nickname: '管理员',
    employeeName: '张三',
    companyId: 'c1',
    deptId: 'd1',
    email: '',
    mobile: '',
    officePhone: '',
    status: Status.NORMAL,
    roleIds: ['r1'],
    password: 'secret12',
  } as CreateUserDto;
}

describe('UserService', () => {
  function setup() {
    const prisma = {
      user: {
        count: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      company: { findUnique: vi.fn() },
      dept: { findUnique: vi.fn() },
      role: { findMany: vi.fn() },
      knowledge: { count: vi.fn() },
      conversation: { count: vi.fn() },
    };
    const service = new UserService(prisma as unknown as PrismaService);
    return { prisma, service };
  }

  it('rejects a department outside the selected company', async () => {
    const { prisma, service } = setup();
    prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.dept.findUnique.mockResolvedValue({ id: 'd1', companyId: 'other' });

    await expect(service.create(payload())).rejects.toThrow(
      '部门不属于所选公司',
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('stores a hash and omits it from the response', async () => {
    const { prisma, service } = setup();
    prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.dept.findUnique.mockResolvedValue({ id: 'd1', companyId: 'c1' });
    prisma.role.findMany.mockResolvedValue([{ id: 'r1' }]);
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'u1',
      username: 'admin',
      passwordHash: 'hashed:secret12',
      nickname: '管理员',
      employeeName: '张三',
      companyId: 'c1',
      deptId: 'd1',
      email: '',
      mobile: '',
      officePhone: '',
      status: Status.NORMAL,
      createdAt: now,
      updatedAt: now,
      company: { name: '集团' },
      dept: { name: '研发' },
      roles: [{ role: { id: 'r1', name: '管理员', sort: 1 } }],
    });

    const result = await service.create(payload());

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passwordHash: 'hashed:secret12' }),
      }),
    );
    expect(result).not.toHaveProperty('passwordHash');
    expect(result.companyName).toBe('集团');
    expect(result.roleNames).toEqual(['管理员']);
  });
});
