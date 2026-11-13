import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Dept } from '@prisma/client';
import { toPageResult, type PageResult } from '../../../common/dto/page.dto.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { rethrowPrisma } from '../../../common/utils/prisma-error.js';
import {
  buildTree,
  countNodes,
  createsCycle,
  keepWithAncestors,
} from '../../../common/utils/tree.js';
import { DeptPayloadDto, DeptQueryDto, DeptView } from './dto/dept.dto.js';

const deptInclude = {
  company: { select: { name: true } },
} as const satisfies Prisma.DeptInclude;

type DeptRow = Dept & { company: { name: string } };

@Injectable()
export class DeptService {
  constructor(private readonly prisma: PrismaService) {}

  async findPage(query: DeptQueryDto): Promise<PageResult<DeptView>> {
    const rows = await this.prisma.dept.findMany({
      include: deptInclude,
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    });
    const scoped = query.companyId
      ? rows.filter((row) => row.companyId === query.companyId)
      : rows;
    const keyword = query.name?.trim().toLowerCase() ?? '';
    const matched = scoped.filter((row) => {
      const hitKeyword =
        !keyword ||
        row.name.toLowerCase().includes(keyword) ||
        row.code.toLowerCase().includes(keyword);
      const hitStatus = !query.status || row.status === query.status;
      return hitKeyword && hitStatus;
    });
    const tree = buildTree(keepWithAncestors(scoped, matched).map(toDeptView));
    return toPageResult(tree, countNodes(tree), query);
  }

  async create(dto: DeptPayloadDto): Promise<DeptView> {
    await this.assertCompany(dto.companyId);
    await this.assertParent(null, dto);
    await this.assertCode(dto.companyId, dto.code);
    try {
      const saved = await this.prisma.dept.create({
        data: toData(dto),
        include: deptInclude,
      });
      return toDeptView(saved);
    } catch (error) {
      rethrowPrisma(error);
    }
  }

  async update(id: string, dto: DeptPayloadDto): Promise<DeptView> {
    const current = await this.prisma.dept.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('部门不存在');
    await this.assertCompany(dto.companyId);
    if (current.companyId !== dto.companyId) await this.assertCanMove(id);
    await this.assertParent(id, dto);
    await this.assertCode(dto.companyId, dto.code, id);
    try {
      const saved = await this.prisma.dept.update({
        where: { id },
        data: toData(dto),
        include: deptInclude,
      });
      return toDeptView(saved);
    } catch (error) {
      rethrowPrisma(error);
    }
  }

  async remove(id: string): Promise<null> {
    const current = await this.prisma.dept.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!current) throw new NotFoundException('部门不存在');

    const [children, users, links] = await Promise.all([
      this.prisma.dept.count({ where: { parentId: id } }),
      this.prisma.user.count({ where: { deptId: id } }),
      this.prisma.knowledgeDept.count({ where: { deptId: id } }),
    ]);
    if (children) throw new BadRequestException('请先删除下级部门');
    if (users) throw new BadRequestException('请先删除部门下的用户');
    if (links) throw new BadRequestException('部门已被知识库引用，无法删除');

    try {
      await this.prisma.dept.delete({ where: { id } });
    } catch (error) {
      rethrowPrisma(error);
    }
    return null;
  }

  private async assertCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('公司不存在');
  }

  private async assertCanMove(id: string) {
    const [children, users] = await Promise.all([
      this.prisma.dept.count({ where: { parentId: id } }),
      this.prisma.user.count({ where: { deptId: id } }),
    ]);
    if (children || users) {
      throw new BadRequestException('部门下已有下级或用户，不能变更所属公司');
    }
  }

  private async assertParent(id: string | null, dto: DeptPayloadDto) {
    if (!dto.parentId) return;
    const parent = await this.prisma.dept.findUnique({
      where: { id: dto.parentId },
      select: { id: true, companyId: true },
    });
    if (!parent) throw new NotFoundException('上级部门不存在');
    if (parent.companyId !== dto.companyId) {
      throw new BadRequestException('上级部门必须属于同一公司');
    }
    if (!id) return;

    const all = await this.prisma.dept.findMany({
      select: { id: true, parentId: true },
    });
    if (createsCycle(all, id, dto.parentId)) {
      throw new BadRequestException('上级部门不能是自己或下级部门');
    }
  }

  private async assertCode(companyId: string, code: string, id?: string) {
    const duplicated = await this.prisma.dept.findFirst({
      where: { companyId, code, ...(id ? { NOT: { id } } : {}) },
      select: { id: true },
    });
    if (duplicated) throw new ConflictException('部门编码已存在');
  }
}

function toData(dto: DeptPayloadDto) {
  return {
    name: dto.name,
    code: dto.code,
    companyId: dto.companyId,
    parentId: dto.parentId,
    sort: dto.sort,
    leader: dto.leader,
    status: dto.status,
  };
}

function toDeptView(row: DeptRow): DeptView {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    companyId: row.companyId,
    companyName: row.company.name,
    parentId: row.parentId,
    sort: row.sort,
    leader: row.leader,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
  };
}
