import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Status } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PageQueryDto } from '../../../../common/dto/page.dto.js';
import {
  BlankToUndefined,
  EmptyToNull,
  Trim,
} from '../../../../common/dto/transforms.js';
import { IsNullableId } from '../../../../common/dto/validators.js';

export class DeptQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '名称或编码' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @BlankToUndefined()
  name?: string;

  @ApiPropertyOptional({ enum: Status, enumName: 'Status' })
  @IsOptional()
  @IsEnum(Status, { message: '状态不正确' })
  @BlankToUndefined()
  status?: Status;

  @ApiPropertyOptional({ description: '所属公司' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @BlankToUndefined()
  companyId?: string;
}

export class DeptPayloadDto {
  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty({ message: '请输入部门名称' })
  @MaxLength(50, { message: '部门名称不超过 50 个字' })
  @Trim()
  name!: string;

  @ApiProperty({ maxLength: 64 })
  @IsString()
  @IsNotEmpty({ message: '请输入部门编码' })
  @MaxLength(64, { message: '部门编码不超过 64 个字' })
  @Trim()
  code!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: '请选择所属公司' })
  @MaxLength(64)
  @Trim()
  companyId!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: '上级部门，null 为一级部门',
  })
  @IsNullableId('上级部门不正确')
  @EmptyToNull()
  parentId!: string | null;

  @ApiProperty({ minimum: 0, maximum: 9999 })
  @Type(() => Number)
  @IsInt({ message: '排序必须是整数' })
  @Min(0, { message: '排序不能小于 0' })
  @Max(9999, { message: '排序不能大于 9999' })
  sort!: number;

  @ApiProperty({ maxLength: 50 })
  @IsString()
  @MaxLength(50)
  @Trim()
  leader!: string;

  @ApiProperty({ enum: Status, enumName: 'Status' })
  @IsEnum(Status, { message: '状态不正确' })
  status!: Status;
}

export class DeptView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  companyName!: string;

  @ApiProperty({ type: String, nullable: true })
  parentId!: string | null;

  @ApiProperty()
  sort!: number;

  @ApiProperty()
  leader!: string;

  @ApiProperty({ enum: Status, enumName: 'Status' })
  status!: Status;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  updatedAt!: string;

  @ApiPropertyOptional({ type: () => [DeptView] })
  children?: DeptView[];
}
