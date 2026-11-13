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
import { rethrowPrisma } from '../../../common/utils/prisma-error.js';
import {
  RoleMenuDto,
  RolePayloadDto,
  RoleQueryDto,
  RoleView,
} from './dto/role.dto.js';

const roleInclude = {
  menus: {
    include: {
      menu: { select: { id: true, sort: true, name: true } },
    },
  },
} as const satisfies Prisma.RoleInclude;

type RoleRow = Prisma.RoleGetPayload<{ include: typeof roleInclude }>;

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaService) {}

  async findPage(query: RoleQueryDto): Promise<PageResult<RoleView>> {
    const where = roleWhere(query);
    const [total, rows] = await Promise.all([
      this.prisma.role.count({ where }),
      this.prisma.role.findMany({
        where,
        include: roleInclude,
        orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
        ...pageArgs(query),
      }),
    ]);
    return toPageResult(rows.map(toRoleView), total, query);
  }

  async create(dto: RolePayloadDto): Promise<RoleView> {
    await this.assertCode(dto.code);
    try {
      const saved = await this.prisma.role.create({
        data: toData(dto),
        include: roleInclude,
      });
      return toRoleView(saved);
    } catch (error) {
      rethrowPrisma(error);
    }
  }

  async update(id: string, dto: RolePayloadDto): Promise<RoleView> {
    await this.ensureRole(id);
    await this.assertCode(dto.code, id);
    try {
      const saved = await this.prisma.role.update({
        where: { id },
        data: toData(dto),
        include: roleInclude,
      });
      return toRoleView(saved);
    } catch (error) {
      rethrowPrisma(error);
    }
  }

  async updateMenus(id: string, dto: RoleMenuDto): Promise<RoleView> {
    await this.ensureRole(id);
    if (dto.menuIds.length) {
      const found = await this.prisma.menu.findMany({
        where: { id: { in: dto.menuIds } },
        select: { id: true },
      });
      if (found.length !== dto.menuIds.length) {
        throw new BadRequestException('存在无效的菜单');
      }
    }
    try {
      const saved = await this.prisma.role.update({
        where: { id },
        data: {
          dataScope: dto.dataScope,
          menus: {
            deleteMany: {},
            create: dto.menuIds.map((menuId) => ({ menuId })),
          },
        },
        include: roleInclude,
      });
      return toRoleView(saved);
    } catch (error) {
      rethrowPrisma(error);
    }
  }

  async remove(id: string): Promise<null> {
    await this.ensureRole(id);
    const assigned = await this.prisma.userRole.count({
      where: { roleId: id },
    });
    if (assigned) throw new BadRequestException('角色已分配给用户，无法删除');
    try {
      await this.prisma.role.delete({ where: { id } });
    } catch (error) {
      rethrowPrisma(error);
    }
    return null;
  }

  private async ensureRole(id: string) {
    const current = await this.prisma.role.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!current) throw new NotFoundException('角色不存在');
  }

  private async assertCode(code: string, id?: string) {
    const duplicated = await this.prisma.role.findFirst({
      where: { code, ...(id ? { NOT: { id } } : {}) },
      select: { id: true },
    });
    if (duplicated) throw new ConflictException('角色编码已存在');
  }
}

function roleWhere(query: RoleQueryDto): Prisma.RoleWhereInput {
  const keyword = query.name?.trim();
  return {
    ...(keyword
      ? {
          OR: [
            { name: { contains: keyword, mode: 'insensitive' } },
            { code: { contains: keyword, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(query.status ? { status: query.status } : {}),
  };
}

function toData(dto: RolePayloadDto) {
  return {
    name: dto.name,
    code: dto.code,
    sort: dto.sort,
    status: dto.status,
    dataScope: dto.dataScope,
    remark: dto.remark,
  };
}

function toRoleView(row: RoleRow): RoleView {
  const menus = [...row.menus].sort(
    (a, b) =>
      a.menu.sort - b.menu.sort || a.menu.name.localeCompare(b.menu.name, 'zh'),
  );
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    sort: row.sort,
    status: row.status,
    dataScope: row.dataScope,
    remark: row.remark,
    menuIds: menus.map((item) => item.menu.id),
    updatedAt: row.updatedAt.toISOString(),
  };
}
