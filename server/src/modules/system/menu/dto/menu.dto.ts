import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MenuType } from '@prisma/client';
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
import {
  BlankToUndefined,
  EmptyToNull,
  Trim,
} from '../../../../common/dto/transforms.js';
import { IsNullableId } from '../../../../common/dto/validators.js';

export class MenuQueryDto {
  @ApiPropertyOptional({ description: '名称、路由或权限标识' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @BlankToUndefined()
  name?: string;

  @ApiPropertyOptional({ enum: MenuType, enumName: 'MenuType' })
  @IsOptional()
  @IsEnum(MenuType, { message: '菜单类型不正确' })
  @BlankToUndefined()
  type?: MenuType;
}

export class MenuPayloadDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description: '上级菜单，null 为顶级',
  })
  @IsNullableId('上级菜单不正确')
  @EmptyToNull()
  parentId!: string | null;

  @ApiProperty({ maxLength: 30 })
  @IsString()
  @IsNotEmpty({ message: '请输入名称' })
  @MaxLength(30, { message: '名称不超过 30 个字' })
  @Trim()
  name!: string;

  @ApiProperty({ description: '按钮传空字符串' })
  @IsString()
  @MaxLength(120)
  @Trim()
  path!: string;

  @ApiProperty({ description: '仅菜单需要页面组件，其余传空字符串' })
  @IsString()
  @MaxLength(120)
  @Trim()
  component!: string;

  @ApiProperty({ description: '按钮传空字符串' })
  @IsString()
  @MaxLength(64)
  @Trim()
  icon!: string;

  @ApiProperty({ minimum: 0, maximum: 9999 })
  @Type(() => Number)
  @IsInt({ message: '排序必须是整数' })
  @Min(0, { message: '排序不能小于 0' })
  @Max(9999, { message: '排序不能大于 9999' })
  sort!: number;

  @ApiProperty({ enum: MenuType, enumName: 'MenuType' })
  @IsEnum(MenuType, { message: '菜单类型不正确' })
  type!: MenuType;

  @ApiProperty({ description: '目录传空字符串，按钮必填' })
  @IsString()
  @MaxLength(100)
  @Trim()
  permission!: string;
}

export class MenuView {
  @ApiProperty()
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  parentId!: string | null;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  path!: string;

  @ApiProperty()
  component!: string;

  @ApiProperty()
  icon!: string;

  @ApiProperty()
  sort!: number;

  @ApiProperty({ enum: MenuType, enumName: 'MenuType' })
  type!: MenuType;

  @ApiProperty()
  permission!: string;

  @ApiPropertyOptional({ type: () => [MenuView] })
  children?: MenuView[];
}
