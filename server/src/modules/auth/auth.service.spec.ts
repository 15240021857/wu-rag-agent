import { DataScope, MenuType, Status, type Menu } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import type { PrismaService } from '../../common/prisma/prisma.service.js';
import { AuthService } from './auth.service.js';

vi.mock('../../common/utils/password.js', () => ({
  hashPassword: vi.fn((password: string) =>
    Promise.resolve(`hashed:${password}`),
  ),
  verifyPassword: vi.fn((password: string, hash: string) =>
    Promise.resolve(hash === `hashed:${password}`),
  ),
}));

const now = new Date('2026-01-01T00:00:00.000Z');

function menu(
  partial: Pick<
    Menu,
    'id' | 'parentId' | 'name' | 'sort' | 'type' | 'permission'
  > &
    Partial<Menu>,
): Menu {
  return {
    path: '',
    component: '',
    icon: '',
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

const menus: Menu[] = [
  menu({
    id: 'm_dashboard',
    parentId: null,
    name: '工作台',
    path: '/dashboard',
    component: 'dashboard/index',
    sort: 1,
    type: MenuType.MENU,
    permission: '',
  }),
  menu({
    id: 'm_system',
    parentId: null,
    name: '系统管理',
    path: '/system',
    sort: 2,
    type: MenuType.DIR,
    permission: '',
  }),
  menu({
    id: 'm_user',
    parentId: 'm_system',
    name: '用户管理',
    path: '/system/user',
    component: 'system/user/index',
    sort: 1,
    type: MenuType.MENU,
    permission: 'system:user:query',
  }),
  menu({
    id: 'b_user_create',
    parentId: 'm_user',
    name: '新增用户',
    sort: 1,
    type: MenuType.BUTTON,
    permission: 'system:user:create',
  }),
  menu({
    id: 'b_user_create_dup',
    parentId: 'm_user',
    name: '新增用户副本',
    sort: 2,
    type: MenuType.BUTTON,
    permission: 'system:user:create',
  }),
];

function userRow() {
  return {
    id: 'u1',
    username: 'admin',
    passwordHash: 'hashed:123456',
    nickname: '管理员',
    employeeName: '张三',
    companyId: 'c1',
    deptId: 'd1',
    email: 'a@test.com',
    mobile: '13800000000',
    officePhone: '',
    status: Status.NORMAL,
    createdAt: now,
    updatedAt: now,
    company: { name: '安徽公司' },
    dept: { name: '企管部' },
    roles: [
      {
        role: {
          dataScope: DataScope.DEPT,
          menus: [{ menuId: 'm_dashboard' }, { menuId: 'b_user_create' }],
        },
      },
      {
        role: {
          dataScope: DataScope.ALL,
          menus: [{ menuId: 'm_user' }, { menuId: 'b_user_create_dup' }],
        },
      },
    ],
  };
}

describe('AuthService', () => {
  function setup() {
    const prisma = {
      user: { findUnique: vi.fn() },
      menu: { findMany: vi.fn() },
    };
    const jwt = new JwtService({
      secret: 'test-secret',
      signOptions: { expiresIn: '1h' },
    });
    const signAsync = vi.spyOn(jwt, 'signAsync');
    const service = new AuthService(prisma as unknown as PrismaService, jwt);
    return { prisma, jwt, signAsync, service };
  }

  it('returns a token that identifies the user', async () => {
    const { prisma, jwt, signAsync, service } = setup();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      username: 'admin',
      passwordHash: 'hashed:123456',
      status: Status.NORMAL,
    });

    const result = await service.login({
      username: 'admin',
      password: '123456',
    });

    expect(signAsync).toHaveBeenCalledWith({ sub: 'u1', username: 'admin' });
    expect(jwt.verify(result.token)).toMatchObject({
      sub: 'u1',
      username: 'admin',
    });
  });

  it('rejects an unknown account and a wrong password the same way', async () => {
    const { prisma, signAsync, service } = setup();
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({ username: 'missing', password: '123456' }),
    ).rejects.toThrow('账号或密码错误');

    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      username: 'admin',
      passwordHash: 'hashed:123456',
      status: Status.NORMAL,
    });
    await expect(
      service.login({ username: 'admin', password: 'wrong-password' }),
    ).rejects.toThrow('账号或密码错误');
    expect(signAsync).not.toHaveBeenCalled();
  });

  it('rejects a disabled account after the password matches', async () => {
    const { prisma, signAsync, service } = setup();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      username: 'admin',
      passwordHash: 'hashed:123456',
      status: Status.DISABLED,
    });

    await expect(
      service.login({ username: 'admin', password: '123456' }),
    ).rejects.toThrow('账号已停用');
    expect(signAsync).not.toHaveBeenCalled();
  });

  it('builds permissions, the widest data scope, and a menu tree without buttons', async () => {
    const { prisma, service } = setup();
    prisma.user.findUnique.mockResolvedValue(userRow());
    prisma.menu.findMany.mockResolvedValue(menus);

    const profile = await service.profile('u1');

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          roles: expect.objectContaining({
            where: { role: { status: Status.NORMAL } },
          }),
        }),
      }),
    );
    expect(profile.user).toMatchObject({
      id: 'u1',
      username: 'admin',
      companyName: '安徽公司',
      deptName: '企管部',
    });
    expect(profile.permissions).toEqual([
      'system:user:query',
      'system:user:create',
    ]);
    expect(profile.menus.map((item) => item.id)).toEqual([
      'm_dashboard',
      'm_system',
    ]);
    expect(profile.menus[1]?.children?.map((item) => item.id)).toEqual([
      'm_user',
    ]);
    expect(JSON.stringify(profile.menus)).not.toContain('BUTTON');

    const authUser = await service.getAuthUser('u1');
    expect(authUser?.dataScope).toBe(DataScope.ALL);
    expect(authUser?.permissions).toEqual(profile.permissions);
  });

  it('treats a disabled user as logged out', async () => {
    const { prisma, service } = setup();
    prisma.user.findUnique.mockResolvedValue({
      ...userRow(),
      status: Status.DISABLED,
    });

    await expect(service.profile('u1')).rejects.toThrow(
      '登录已过期，请重新登录',
    );
    expect(await service.getAuthUser('u1')).toBeNull();
    expect(prisma.menu.findMany).not.toHaveBeenCalled();
  });
});
