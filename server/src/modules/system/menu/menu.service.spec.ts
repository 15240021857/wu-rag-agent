import { MenuType, type Menu } from '@prisma/client';
import type { PrismaService } from '../../../common/prisma/prisma.service.js';
import type { MenuPayloadDto } from './dto/menu.dto.js';
import { MenuService } from './menu.service.js';

const now = new Date('2026-01-01T00:00:00.000Z');

function menu(
  partial: Partial<Menu> & Pick<Menu, 'id' | 'name' | 'parentId' | 'type'>,
): Menu {
  return {
    path: '',
    component: '',
    icon: '',
    sort: 1,
    permission: '',
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

function payload(partial: Partial<MenuPayloadDto> = {}): MenuPayloadDto {
  return {
    parentId: null,
    name: '系统',
    path: '/system',
    component: '',
    icon: '',
    sort: 1,
    type: MenuType.DIR,
    permission: '',
    ...partial,
  };
}

describe('MenuService', () => {
  function setup() {
    const prisma = {
      menu: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
    };
    const service = new MenuService(prisma as unknown as PrismaService);
    return { prisma, service };
  }

  it('keeps ancestor menus when a button name matches', async () => {
    const { prisma, service } = setup();
    prisma.menu.findMany.mockResolvedValue([
      menu({
        id: 'd',
        name: '系统',
        parentId: null,
        type: MenuType.DIR,
        path: '/system',
      }),
      menu({
        id: 'm',
        name: '用户',
        parentId: 'd',
        type: MenuType.MENU,
        path: '/system/user',
        component: 'system/user/index',
      }),
      menu({
        id: 'b',
        name: '新增',
        parentId: 'm',
        type: MenuType.BUTTON,
        permission: 'system:user:create',
      }),
    ]);

    const tree = await service.findAll({ name: '新增' });

    expect(tree.map((item) => item.id)).toEqual(['d']);
    expect(tree[0].children?.[0].children?.map((item) => item.id)).toEqual([
      'b',
    ]);
  });

  it('requires a button to hang under a menu', async () => {
    const { prisma, service } = setup();
    prisma.menu.findMany.mockResolvedValue([
      { id: 'd', parentId: null, path: '/system', type: MenuType.DIR },
    ]);

    await expect(
      service.create(
        payload({
          parentId: 'd',
          name: '新增',
          path: '',
          type: MenuType.BUTTON,
          permission: 'system:user:create',
        }),
      ),
    ).rejects.toThrow('按钮必须挂在菜单下');
  });

  it('requires a child path to extend its parent path', async () => {
    const { prisma, service } = setup();
    prisma.menu.findMany.mockResolvedValue([
      { id: 'd', parentId: null, path: '/system', type: MenuType.DIR },
    ]);

    await expect(
      service.create(
        payload({
          parentId: 'd',
          name: '用户',
          path: '/user',
          component: 'system/user/index',
          type: MenuType.MENU,
        }),
      ),
    ).rejects.toThrow('路由地址需以 /system/ 开头');
  });

  it('blocks deletion while child menus exist', async () => {
    const { prisma, service } = setup();
    prisma.menu.findUnique.mockResolvedValue({ id: 'd' });
    prisma.menu.count.mockResolvedValue(1);

    await expect(service.remove('d')).rejects.toThrow('请先删除下级菜单');
  });
});
