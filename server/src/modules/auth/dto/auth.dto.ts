import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../../common/dto/transforms.js';
import { MenuView } from '../../system/menu/dto/menu.dto.js';

export class LoginDto {
  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty({ message: '请输入登录账号' })
  @MaxLength(50, { message: '登录账号不超过 50 个字' })
  @Trim()
  username!: string;

  @ApiProperty({ maxLength: 72 })
  @IsString()
  @IsNotEmpty({ message: '请输入密码' })
  @MaxLength(72, { message: '密码不超过 72 位' })
  password!: string;
}

export class LoginResult {
  @ApiProperty()
  token!: string;
}

export class ProfileUserView {
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
}

export class ProfileView {
  @ApiProperty({ type: () => ProfileUserView })
  user!: ProfileUserView;

  @ApiProperty({ type: [String] })
  permissions!: string[];

  @ApiProperty({ type: () => [MenuView] })
  menus!: MenuView[];
}
