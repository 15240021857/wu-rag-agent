import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataScope, MenuType, Prisma, Status, type Menu } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { hashPassword, verifyPassword } from '../../common/utils/password.js';
import { buildTree, keepWithAncestors } from '../../common/utils/tree.js';
import { MenuView } from '../system/menu/dto/menu.dto.js';
import type { AuthUser } from './auth.types.js';
import { LoginDto, ProfileView } from './dto/auth.dto.js';

const DUMMY_PASSWORD = 'not-a-real-user';

const SCOPE_RANK: Record<DataScope, number> = {
  [DataScope.SELF]: 1,
  [DataScope.DEPT]: 2,
  [DataScope.COMPANY]: 3,
  [DataScope.ALL]: 4,
};

const sessionInclude = {
  company: { select: { name: true } },
  dept: { select: { name: true } },
  roles: {
    where: { role: { status: Status.NORMAL } },
    include: {
      role: {
        select: {
          dataScope: true,
          menus: { select: { menuId: true } },
        },
      },
    },
  },
} as const satisfies Prisma.UserInclude;

type SessionUser = Prisma.UserGetPayload<{ include: typeof sessionInclude }>;

interface Session extends AuthUser {
  nickname: string;
  employeeName: string;
  companyName: string;
  deptName: string;
  email: string;
  mobile: string;
  menus: MenuView[];
}

@Injectable()
export class AuthService {
  private dummyHash: Promise<string> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<{ token: string }> {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
      select: { id: true, username: true, passwordHash: true, status: true },
    });
    if (!user) {
      await this.rejectUnknownPassword(dto.password);
      throw new BadRequestException('账号或密码错误');
    }
    const matched = await verifyPassword(dto.password, user.passwordHash);
    if (!matched) throw new BadRequestException('账号或密码错误');
    if (user.status !== Status.NORMAL) {
      throw new BadRequestException('账号已停用');
    }
    const token = await this.jwt.signAsync({
      sub: user.id,
      username: user.username,
    });
    return { token };
  }

  async getAuthUser(userId: string): Promise<AuthUser | null> {
    const session = await this.loadSession(userId);
    if (!session) return null;
    return {
      id: session.id,
      username: session.username,
      companyId: session.companyId,
      deptId: session.deptId,
      permissions: session.permissions,
      dataScope: session.dataScope,
    };
  }

  async profile(userId: string): Promise<ProfileView> {
    const session = await this.loadSession(userId);
    if (!session) throw new UnauthorizedException('登录已过期，请重新登录');
    return {
      user: {
        id: session.id,
        username: session.username,
        nickname: session.nickname,
        employeeName: session.employeeName,
        companyId: session.companyId,
        companyName: session.companyName,
        deptId: session.deptId,
        deptName: session.deptName,
        email: session.email,
        mobile: session.mobile,
      },
      permissions: session.permissions,
      menus: session.menus,
    };
  }

  private async loadSession(userId: string): Promise<Session | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: sessionInclude,
    });
    if (!user || user.status !== Status.NORMAL) return null;
    const menus = await this.prisma.menu.findMany({
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    });
    return toSession(user, menus);
  }

  private async rejectUnknownPassword(password: string) {
    this.dummyHash ??= hashPassword(DUMMY_PASSWORD);
    const hash = await this.dummyHash;
    await verifyPassword(password, hash);
  }
}

function widestScope(scopes: DataScope[]): DataScope {
  return scopes.reduce(
    (current, scope) =>
      SCOPE_RANK[scope] > SCOPE_RANK[current] ? scope : current,
    DataScope.SELF,
  );
}

function toSession(user: SessionUser, menus: Menu[]): Session {
  const ownedIds = new Set<string>();
  for (const link of user.roles) {
    for (const item of link.role.menus) ownedIds.add(item.menuId);
  }

  const permissions: string[] = [];
  const seen = new Set<string>();
  for (const menu of menus) {
    if (
      !ownedIds.has(menu.id) ||
      !menu.permission ||
      seen.has(menu.permission)
    ) {
      continue;
    }
    seen.add(menu.permission);
    permissions.push(menu.permission);
  }

  const visible = keepWithAncestors(
    menus,
    menus.filter((menu) => ownedIds.has(menu.id)),
  ).filter((menu) => menu.type !== MenuType.BUTTON);

  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    employeeName: user.employeeName,
    companyId: user.companyId,
    companyName: user.company.name,
    deptId: user.deptId,
    deptName: user.dept.name,
    email: user.email,
    mobile: user.mobile,
    permissions,
    dataScope: widestScope(user.roles.map((link) => link.role.dataScope)),
    menus: buildTree(visible.map(toMenuNode)),
  };
}

function toMenuNode(row: Menu): MenuView {
  return {
    id: row.id,
    parentId: row.parentId,
    name: row.name,
    path: row.path,
    component: row.component,
    icon: row.icon,
    sort: row.sort,
    type: row.type,
    permission: row.permission,
  };
}
