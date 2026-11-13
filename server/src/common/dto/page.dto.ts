import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

function QueryNumber() {
  return Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return Number(value);
  });
}

export class PageQueryDto {
  @ApiPropertyOptional({
    type: Number,
    description: '页码，从 1 开始',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsInt({ message: '页码必须是整数' })
  @Min(1, { message: '页码最小为 1' })
  @QueryNumber()
  pageNum = 1;

  @ApiPropertyOptional({
    type: Number,
    description: '每页条数。公司、部门树接口会返回全部命中节点',
    default: 10,
    minimum: 1,
    maximum: 500,
  })
  @IsOptional()
  @IsInt({ message: '每页条数必须是整数' })
  @Min(1, { message: '每页条数最小为 1' })
  @Max(500, { message: '每页最多 500 条' })
  @QueryNumber()
  pageSize = 10;
}

export interface PageResult<T> {
  list: T[];
  total: number;
  pageNum: number;
  pageSize: number;
}

export function toPageResult<T>(
  list: T[],
  total: number,
  query: PageQueryDto,
): PageResult<T> {
  return {
    list,
    total,
    pageNum: query.pageNum || 1,
    pageSize: query.pageSize || 10,
  };
}

export function pageArgs(query: PageQueryDto) {
  const pageNum = query.pageNum || 1;
  const pageSize = query.pageSize || 10;
  return {
    skip: (pageNum - 1) * pageSize,
    take: pageSize,
  };
}
