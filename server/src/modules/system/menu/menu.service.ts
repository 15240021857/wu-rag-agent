import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MenuType, type Menu } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { rethrowPrisma } from '../../../common/utils/prisma-error.js';
import {
  buildTree,
  collectDescendantIds,
  createsCycle,
  keepWithAncestors,
} from '../../../common/utils/tree.js';
import { MenuPayloadDto, MenuQueryDto, MenuView } from './dto/menu.dto.js';

const PATH_PATTERN = /^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/;
const COMPONENT_PATTERN = /^[A-Za-z0-9_./-]+$/;

interface MenuInput {
  parentId: string | null;
  name: string;
  path: string;
  component: string;
  icon: string;
  sort: number;
  type: MenuType;
  permission: string;
}

interface MenuLink {
  id: string;
  parentId: string | null;
  path: string;
  type: MenuType;
}

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: MenuQueryDto): Promise<MenuView[]> {
    const rows = await this.prisma.menu.findMany({
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    });
    const keyword = query.name?.trim().toLowerCase() ?? '';
    const matched = rows.filter((row) => {
      const hitKeyword =
        !keyword ||
        row.name.toLowerCase().includes(keyword) ||
        row.path.toLowerCase().includes(keyword) ||
        row.permission.toLowerCase().includes(keyword);
      const hitType = !query.type || row.type === query.type;
      return hitKeyword && hitType;
    });
    return buildTree(keepWithAncestors(rows, matched).map(toMenuView));
  }

  async create(dto: MenuPayloadDto): Promise<MenuView> {
    const normalized = normalize(dto);
    const all = await this.links();
    const parent = this.parentOf(all, normalized.parentId);
    this.assertParentType(normalized.type, parent);
    this.assertPathPrefix(parent, normalized.path);
    await this.assertPathUnique(normalized.path);
    try {
      const saved = await this.prisma.menu.create({ data: normalized });
      return toMenuView(saved);
    } catch (error) {
      rethrowPrisma(error);
    }
  }

  async update(id: string, dto: MenuPayloadDto): Promise<MenuView> {
    const existing = await this.prisma.menu.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('菜单不存在');
    const normalized = normalize(dto);
    if (existing.type !== normalized.type) {
      const childCount = await this.prisma.menu.count({
        where: { parentId: id },
      });
      if (childCount > 0)
        throw new BadRequestException('存在下级菜单，不能修改类型');
    }
    const all = await this.links();
    const parent = this.parentOf(all, normalized.parentId);
    this.assertParentType(normalized.type, parent);
    if (createsCycle(all, id, normalized.parentId)) {
      throw new BadRequestException('上级菜单不能是自己或下级菜单');
    }
    this.assertPathPrefix(parent, normalized.path);
    if (normalized.path && normalized.path !== existing.path) {
      const descendantIds = new Set(collectDescendantIds(all, id));
      const broken = all.some(
        (item) =>
          descendantIds.has(item.id) &&
          Boolean(item.path) &&
          !item.path.startsWith(`${normalized.path}/`),
      );
      if (broken) throw new BadRequestException('下级路由与新的路由地址不匹配');
    }
    await this.assertPathUnique(normalized.path, id);
    try {
      const saved = await this.prisma.menu.update({
        where: { id },
        data: normalized,
      });
      return toMenuView(saved);
    } catch (error) {
      rethrowPrisma(error);
    }
  }

  async remove(id: string): Promise<null> {
    const existing = await this.prisma.menu.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('菜单不存在');
    const children = await this.prisma.menu.count({ where: { parentId: id } });
    if (children) throw new BadRequestException('请先删除下级菜单');
    try {
      await this.prisma.menu.delete({ where: { id } });
    } catch (error) {
      rethrowPrisma(error);
    }
    return null;
  }

  private async links(): Promise<MenuLink[]> {
    return this.prisma.menu.findMany({
      select: { id: true, parentId: true, path: true, type: true },
    });
  }

  private parentOf(all: MenuLink[], parentId: string | null) {
    if (!parentId) return null;
    const parent = all.find((item) => item.id === parentId);
    if (!parent) throw new NotFoundException('上级菜单不存在');
    return parent;
  }

  private assertParentType(type: MenuType, parent: { type: MenuType } | null) {
    if (type === MenuType.BUTTON) {
      if (!parent || parent.type !== MenuType.MENU) {
        throw new BadRequestException('按钮必须挂在菜单下');
      }
      return;
    }
    if (parent && parent.type !== MenuType.DIR) {
      throw new BadRequestException('目录和菜单只能挂在目录下');
    }
  }

  private assertPathPrefix(parent: { path: string } | null, path: string) {
    if (parent?.path && path && !path.startsWith(`${parent.path}/`)) {
      throw new BadRequestException(`路由地址需以 ${parent.path}/ 开头`);
    }
  }

  private async assertPathUnique(path: string, id?: string) {
    if (!path) return;
    const duplicated = await this.prisma.menu.findFirst({
      where: { path, ...(id ? { NOT: { id } } : {}) },
      select: { id: true },
    });
    if (duplicated) throw new ConflictException('路由地址已存在');
  }
}

function normalize(dto: MenuPayloadDto): MenuInput {
  const name = dto.name.trim();
  const sort = dto.sort;
  if (dto.type === MenuType.BUTTON) {
    if (!dto.permission.trim()) throw new BadRequestException('请输入权限标识');
    if (!dto.parentId) throw new BadRequestException('请选择所属菜单');
    return {
      parentId: dto.parentId,
      name,
      path: '',
      component: '',
      icon: '',
      sort,
      type: dto.type,
      permission: dto.permission.trim(),
    };
  }

  const path = dto.path.trim();
  if (!PATH_PATTERN.test(path)) {
    throw new BadRequestException('路由地址需以 / 开头，仅含字母、数字、-、_');
  }
  if (dto.type === MenuType.DIR) {
    return {
      parentId: dto.parentId,
      name,
      path,
      component: '',
      permission: '',
      icon: dto.icon.trim(),
      sort,
      type: dto.type,
    };
  }

  const component = dto.component.trim();
  if (!component) throw new BadRequestException('请选择页面组件');
  if (!COMPONENT_PATTERN.test(component)) {
    throw new BadRequestException('页面组件格式不正确');
  }
  return {
    parentId: dto.parentId,
    name,
    path,
    component,
    icon: dto.icon.trim(),
    sort,
    type: dto.type,
    permission: dto.permission.trim(),
  };
}

function toMenuView(row: Menu): MenuView {
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
