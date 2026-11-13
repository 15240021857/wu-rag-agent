import { DataScope } from '@prisma/client';
import type { PrismaService } from '../../../common/prisma/prisma.service.js';
import { RoleService } from './role.service.js';

describe('RoleService', () => {
  function setup() {
    const prisma = {
      role: {
        count: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      userRole: { count: vi.fn() },
      menu: { findMany: vi.fn() },
    };
    const service = new RoleService(prisma as unknown as PrismaService);
    return { prisma, service };
  }

  it('blocks deletion when the role is assigned', async () => {
    const { prisma, service } = setup();
    prisma.role.findUnique.mockResolvedValue({ id: 'r1' });
    prisma.userRole.count.mockResolvedValue(1);

    await expect(service.remove('r1')).rejects.toThrow(
      '角色已分配给用户，无法删除',
    );
    expect(prisma.role.delete).not.toHaveBeenCalled();
  });

  it('rejects unknown menus when granting access', async () => {
    const { prisma, service } = setup();
    prisma.role.findUnique.mockResolvedValue({ id: 'r1' });
    prisma.menu.findMany.mockResolvedValue([{ id: 'm1' }]);

    await expect(
      service.updateMenus('r1', {
        menuIds: ['m1', 'm2'],
        dataScope: DataScope.SELF,
      }),
    ).rejects.toThrow('存在无效的菜单');
  });
});
