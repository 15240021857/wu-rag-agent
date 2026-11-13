import {
  ApiProperty,
  ApiPropertyOptional,
  IntersectionType,
  PartialType,
} from '@nestjs/swagger';
import { Status } from '@prisma/client';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PageQueryDto } from '../../../../common/dto/page.dto.js';
import { BlankToUndefined, Trim } from '../../../../common/dto/transforms.js';

export class UserQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '登录账号' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @BlankToUndefined()
  username?: string;

  @ApiPropertyOptional({ description: '昵称或员工姓名' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @BlankToUndefined()
  nickname?: string;

  @ApiPropertyOptional({ enum: Status, enumName: 'Status' })
  @IsOptional()
  @IsEnum(Status, { message: '状态不正确' })
  @BlankToUndefined()
  status?: Status;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @BlankToUndefined()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @BlankToUndefined()
  deptId?: string;
}

export class UserFieldsDto {
  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty({ message: '请输入登录账号' })
  @MaxLength(50, { message: '登录账号不超过 50 个字' })
  @Trim()
  username!: string;

  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty({ message: '请输入用户昵称' })
  @MaxLength(50, { message: '用户昵称不超过 50 个字' })
  @Trim()
  nickname!: string;

  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty({ message: '请输入员工姓名' })
  @MaxLength(50, { message: '员工姓名不超过 50 个字' })
  @Trim()
  employeeName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: '请选择公司' })
  @MaxLength(64)
  @Trim()
  companyId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: '请选择部门' })
  @MaxLength(64)
  @Trim()
  deptId!: string;

  @ApiProperty({ maxLength: 100 })
  @IsString()
  @MaxLength(100)
  @Trim()
  email!: string;

  @ApiProperty({ maxLength: 30 })
  @IsString()
  @MaxLength(30)
  @Trim()
  mobile!: string;

  @ApiProperty({ maxLength: 30 })
  @IsString()
  @MaxLength(30)
  @Trim()
  officePhone!: string;

  @ApiProperty({ enum: Status, enumName: 'Status' })
  @IsEnum(Status, { message: '状态不正确' })
  status!: Status;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayUnique({ message: '角色不能重复' })
  @ArrayMinSize(1, { message: '请选择角色' })
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(64, { each: true })
  roleIds!: string[];
}

export class UserPasswordDto {
  @ApiProperty({ minLength: 6, maxLength: 72 })
  @IsString()
  @MinLength(6, { message: '密码至少 6 位' })
  @MaxLength(72, { message: '密码不超过 72 位' })
  password!: string;
}

export class CreateUserDto extends IntersectionType(
  UserFieldsDto,
  UserPasswordDto,
) {}

export class UpdateUserDto extends IntersectionType(
  UserFieldsDto,
  PartialType(UserPasswordDto),
) {}

export class ResetPasswordDto {
  @ApiProperty({ minLength: 6, maxLength: 72 })
  @IsString()
  @MinLength(6, { message: '密码至少 6 位' })
  @MaxLength(72, { message: '密码不超过 72 位' })
  password!: string;
}

export class UserView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty()
  nickname!: string;

  @ApiProperty()
  employeeName!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  companyName!: string;

  @ApiProperty()
  deptId!: string;

  @ApiProperty()
  deptName!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  mobile!: string;

  @ApiProperty()
  officePhone!: string;

  @ApiProperty({ enum: Status, enumName: 'Status' })
  status!: Status;

  @ApiProperty({ type: [String] })
  roleIds!: string[];

  @ApiProperty({ type: [String] })
  roleNames!: string[];

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  updatedAt!: string;
}
