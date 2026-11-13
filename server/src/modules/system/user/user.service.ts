import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  pageArgs,
  toPageResult,
  type PageResult,
} from '../../../common/dto/page.dto.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { hashPassword } from '../../../common/utils/password.js';
import { rethrowPrisma } from '../../../common/utils/prisma-error.js';
import {
  CreateUserDto,
  ResetPasswordDto,
  UpdateUserDto,
  UserQueryDto,
  UserView,
} from './dto/user.dto.js';

const userInclude = {
  company: { select: { name: true } },
  dept: { select: { name: true } },
  roles: {
    include: {
      role: { select: { id: true, name: true, sort: true } },
    },
  },
} as const satisfies Prisma.UserInclude;

type UserRow = Prisma.UserGetPayload<{ include: typeof userInclude }>;

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findPage(query: UserQueryDto): Promise<PageResult<UserView>> {
    const where = userWhere(query);
    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: userInclude,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query),
      }),
    ]);
    return toPageResult(rows.map(toUserView), total, query);
  }

  async create(dto: CreateUserDto): Promise<UserView> {
    await this.assertOrg(dto.companyId, dto.deptId);
    await this.assertRoles(dto.roleIds);
    await this.assertUsername(dto.username);
    const passwordHash = await hashPassword(dto.password);
    try {
      const saved = await this.prisma.user.create({
        data: {
          ...toData(dto),
          passwordHash,
          roles: { create: dto.roleIds.map((roleId) => ({ roleId })) },
        },
        include: userInclude,
      });
      return toUserView(saved);
    } catch (error) {
      rethrowPrisma(error);
    }
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserView> {
    await this.ensureUser(id);
    await this.assertOrg(dto.companyId, dto.deptId);
    await this.assertRoles(dto.roleIds);
    await this.assertUsername(dto.username, id);
    const passwordHash = dto.password
      ? await hashPassword(dto.password)
      : undefined;
    try {
      const saved = await this.prisma.user.update({
        where: { id },
        data: {
          ...toData(dto),
          ...(passwordHash ? { passwordHash } : {}),
          roles: {
            deleteMany: {},
            create: dto.roleIds.map((roleId) => ({ roleId })),
          },
        },
        include: userInclude,
      });
      return toUserView(saved);
    } catch (error) {
      rethrowPrisma(error);
    }
  }

  async resetPassword(id: string, dto: ResetPasswordDto): Promise<null> {
    await this.ensureUser(id);
    try {
      await this.prisma.user.update({
        where: { id },
        data: { passwordHash: await hashPassword(dto.password) },
      });
    } catch (error) {
      rethrowPrisma(error);
    }
    return null;
  }

  async remove(id: string): Promise<null> {
    await this.ensureUser(id);
    const [owned, conversations] = await Promise.all([
      this.prisma.knowledge.count({ where: { ownerId: id } }),
      this.prisma.conversation.count({ where: { userId: id } }),
    ]);
    if (owned) throw new BadRequestException('该用户仍有知识库，无法删除');
    if (conversations)
      throw new BadRequestException('该用户仍有会话记录，无法删除');

    try {
      await this.prisma.user.delete({ where: { id } });
    } catch (error) {
      rethrowPrisma(error);
    }
    return null;
  }

  private async ensureUser(id: string) {
    const current = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!current) throw new NotFoundException('用户不存在');
  }

  private async assertOrg(companyId: string, deptId: string) {
    const [company, dept] = await Promise.all([
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true },
      }),
      this.prisma.dept.findUnique({
        where: { id: deptId },
        select: { id: true, companyId: true },
      }),
    ]);
    if (!company) throw new NotFoundException('公司不存在');
    if (!dept) throw new NotFoundException('部门不存在');
    if (dept.companyId !== companyId) {
      throw new BadRequestException('部门不属于所选公司');
    }
  }

  private async assertRoles(roleIds: string[]) {
    const found = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: { id: true },
    });
    if (found.length !== roleIds.length) {
      throw new BadRequestException('存在无效的角色');
    }
  }

  private async assertUsername(username: string, id?: string) {
    const duplicated = await this.prisma.user.findFirst({
      where: { username, ...(id ? { NOT: { id } } : {}) },
      select: { id: true },
    });
    if (duplicated) throw new ConflictException('登录账号已存在');
  }
}

function userWhere(query: UserQueryDto): Prisma.UserWhereInput {
  const username = query.username?.trim();
  const nickname = query.nickname?.trim();
  return {
    ...(username
      ? { username: { contains: username, mode: 'insensitive' } }
      : {}),
    ...(nickname
      ? {
          OR: [
            { nickname: { contains: nickname, mode: 'insensitive' } },
            { employeeName: { contains: nickname, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.companyId ? { companyId: query.companyId } : {}),
    ...(query.deptId ? { deptId: query.deptId } : {}),
  };
}

function toData(dto: CreateUserDto | UpdateUserDto) {
  return {
    username: dto.username,
    nickname: dto.nickname,
    employeeName: dto.employeeName,
    companyId: dto.companyId,
    deptId: dto.deptId,
    email: dto.email,
    mobile: dto.mobile,
    officePhone: dto.officePhone,
    status: dto.status,
  };
}

function toUserView(row: UserRow): UserView {
  const roles = [...row.roles].sort(
    (a, b) =>
      a.role.sort - b.role.sort || a.role.name.localeCompare(b.role.name, 'zh'),
  );
  return {
    id: row.id,
    username: row.username,
    nickname: row.nickname,
    employeeName: row.employeeName,
    companyId: row.companyId,
    companyName: row.company.name,
    deptId: row.deptId,
    deptName: row.dept.name,
    email: row.email,
    mobile: row.mobile,
    officePhone: row.officePhone,
    status: row.status,
    roleIds: roles.map((item) => item.role.id),
    roleNames: roles.map((item) => item.role.name),
    updatedAt: row.updatedAt.toISOString(),
  };
}
