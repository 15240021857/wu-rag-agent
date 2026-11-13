import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DataScope, Status } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
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
import { BlankToUndefined, Trim } from '../../../../common/dto/transforms.js';

export class RoleQueryDto extends PageQueryDto {
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
}

export class RolePayloadDto {
  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty({ message: '请输入角色名称' })
  @MaxLength(50, { message: '角色名称不超过 50 个字' })
  @Trim()
  name!: string;

  @ApiProperty({ maxLength: 64 })
  @IsString()
  @IsNotEmpty({ message: '请输入角色编码' })
  @MaxLength(64, { message: '角色编码不超过 64 个字' })
  @Trim()
  code!: string;

  @ApiProperty({ minimum: 0, maximum: 9999 })
  @Type(() => Number)
  @IsInt({ message: '排序必须是整数' })
  @Min(0, { message: '排序不能小于 0' })
  @Max(9999, { message: '排序不能大于 9999' })
  sort!: number;

  @ApiProperty({ enum: Status, enumName: 'Status' })
  @IsEnum(Status, { message: '状态不正确' })
  status!: Status;

  @ApiProperty({ enum: DataScope, enumName: 'DataScope' })
  @IsEnum(DataScope, { message: '数据范围不正确' })
  dataScope!: DataScope;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MaxLength(200)
  @Trim()
  remark!: string;
}

export class RoleMenuDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayUnique({ message: '菜单不能重复' })
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(64, { each: true })
  menuIds!: string[];

  @ApiProperty({ enum: DataScope, enumName: 'DataScope' })
  @IsEnum(DataScope, { message: '数据范围不正确' })
  dataScope!: DataScope;
}

export class RoleView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  sort!: number;

  @ApiProperty({ enum: Status, enumName: 'Status' })
  status!: Status;

  @ApiProperty({ enum: DataScope, enumName: 'DataScope' })
  dataScope!: DataScope;

  @ApiProperty()
  remark!: string;

  @ApiProperty({ type: [String] })
  menuIds!: string[];

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  updatedAt!: string;
}
