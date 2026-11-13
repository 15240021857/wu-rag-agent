import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiExtraModels, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiOkData,
  ApiOkEmpty,
  ApiStandardErrors,
} from '../../common/swagger/api-response.js';
import { MenuView } from '../system/menu/dto/menu.dto.js';
import type { AuthUser } from './auth.types.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import {
  LoginDto,
  LoginResult,
  ProfileUserView,
  ProfileView,
} from './dto/auth.dto.js';

@ApiTags('认证')
@ApiStandardErrors()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '登录', operationId: 'login', security: [] })
  @ApiOkData(LoginResult)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '退出登录',
    description: '令牌无服务端会话，客户端丢弃 token 即可。',
    operationId: 'logout',
    security: [],
  })
  @ApiOkEmpty()
  logout() {
    return null;
  }

  @Get('profile')
  @ApiOperation({ summary: '当前用户、权限和菜单', operationId: 'getProfile' })
  @ApiExtraModels(ProfileUserView, MenuView)
  @ApiOkData(ProfileView)
  profile(@CurrentUser() user: AuthUser) {
    return this.authService.profile(user.id);
  }
}
