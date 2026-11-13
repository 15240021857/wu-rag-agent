import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Company } from '@prisma/client';
import { toPageResult, type PageResult } from '../../../common/dto/page.dto.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { rethrowPrisma } from '../../../common/utils/prisma-error.js';
import {
  buildTree,
  countNodes,
  createsCycle,
  keepWithAncestors,
} from '../../../common/utils/tree.js';
import {
  CompanyPayloadDto,
  CompanyQueryDto,
  CompanyView,
} from './dto/company.dto.js';

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  async findPage(query: CompanyQueryDto): Promise<PageResult<CompanyView>> {
    const rows = await this.prisma.company.findMany({
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    });
    const keyword = query.name?.trim().toLowerCase() ?? '';
    const matched = rows.filter((row) => {
      const hitKeyword =
        !keyword ||
        row.name.toLowerCase().includes(keyword) ||
        row.code.toLowerCase().includes(keyword);
      const hitStatus = !query.status || row.status === query.status;
      return hitKeyword && hitStatus;
    });
    const tree = buildTree(keepWithAncestors(rows, matched).map(toCompanyView));
    return toPageResult(tree, countNodes(tree), query);
  }

  async create(dto: CompanyPayloadDto): Promise<CompanyView> {
    await this.assertParent(null, dto.parentId);
    await this.assertCode(dto.code);
    try {
      const saved = await this.prisma.company.create({ data: toData(dto) });
      return toCompanyView(saved);
    } catch (error) {
      rethrowPrisma(error);
    }
  }

  async update(id: string, dto: CompanyPayloadDto): Promise<CompanyView> {
    const current = await this.prisma.company.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('公司不存在');
    await this.assertParent(id, dto.parentId);
    await this.assertCode(dto.code, id);
    try {
      const saved = await this.prisma.company.update({
        where: { id },
        data: toData(dto),
      });
      return toCompanyView(saved);
    } catch (error) {
      rethrowPrisma(error);
    }
  }

  async remove(id: string): Promise<null> {
    const current = await this.prisma.company.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!current) throw new NotFoundException('公司不存在');

    const [children, depts, users] = await Promise.all([
      this.prisma.company.count({ where: { parentId: id } }),
      this.prisma.dept.count({ where: { companyId: id } }),
      this.prisma.user.count({ where: { companyId: id } }),
    ]);
    if (children) throw new BadRequestException('请先删除下级公司');
    if (depts) throw new BadRequestException('请先删除公司下的部门');
    if (users) throw new BadRequestException('请先删除公司下的用户');

    try {
      await this.prisma.company.delete({ where: { id } });
    } catch (error) {
      rethrowPrisma(error);
    }
    return null;
  }

  private async assertParent(id: string | null, parentId: string | null) {
    if (!parentId) return;
    const parent = await this.prisma.company.findUnique({
      where: { id: parentId },
      select: { id: true },
    });
    if (!parent) throw new NotFoundException('上级公司不存在');
    if (!id) return;

    const all = await this.prisma.company.findMany({
      select: { id: true, parentId: true },
    });
    if (createsCycle(all, id, parentId)) {
      throw new BadRequestException('上级公司不能是自己或下级公司');
    }
  }

  private async assertCode(code: string, id?: string) {
    const duplicated = await this.prisma.company.findFirst({
      where: { code, ...(id ? { NOT: { id } } : {}) },
      select: { id: true },
    });
    if (duplicated) throw new ConflictException('公司编码已存在');
  }
}

function toData(dto: CompanyPayloadDto) {
  return {
    name: dto.name,
    code: dto.code,
    parentId: dto.parentId,
    sort: dto.sort,
    leader: dto.leader,
    phone: dto.phone,
    address: dto.address,
    status: dto.status,
  };
}

function toCompanyView(row: Company): CompanyView {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    parentId: row.parentId,
    sort: row.sort,
    leader: row.leader,
    phone: row.phone,
    address: row.address,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
  };
}
