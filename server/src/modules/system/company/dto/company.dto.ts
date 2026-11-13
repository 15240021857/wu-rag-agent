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
import { IsNullableId } from '../../../../common/dto/validators.js';
import {
  BlankToUndefined,
  EmptyToNull,
  Trim,
} from '../../../../common/dto/transforms.js';

export class CompanyQueryDto extends PageQueryDto {
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

export class CompanyPayloadDto {
  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty({ message: '请输入公司名称' })
  @MaxLength(50, { message: '公司名称不超过 50 个字' })
  @Trim()
  name!: string;

  @ApiProperty({ maxLength: 64 })
  @IsString()
  @IsNotEmpty({ message: '请输入公司编码' })
  @MaxLength(64, { message: '公司编码不超过 64 个字' })
  @Trim()
  code!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: '上级公司，null 为顶级',
  })
  @IsNullableId('上级公司不正确')
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

  @ApiProperty({ maxLength: 30 })
  @IsString()
  @MaxLength(30)
  @Trim()
  phone!: string;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MaxLength(200)
  @Trim()
  address!: string;

  @ApiProperty({ enum: Status, enumName: 'Status' })
  @IsEnum(Status, { message: '状态不正确' })
  status!: Status;
}

export class CompanyView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty({ type: String, nullable: true })
  parentId!: string | null;

  @ApiProperty()
  sort!: number;

  @ApiProperty()
  leader!: string;

  @ApiProperty()
  phone!: string;

  @ApiProperty()
  address!: string;

  @ApiProperty({ enum: Status, enumName: 'Status' })
  status!: Status;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  updatedAt!: string;

  @ApiPropertyOptional({ type: () => [CompanyView] })
  children?: CompanyView[];
}
