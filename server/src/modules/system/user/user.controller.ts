import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiCreatedData,
  ApiOkData,
  ApiOkEmpty,
  ApiOkPage,
  ApiStandardErrors,
} from '../../../common/swagger/api-response.js';
import {
  CreateUserDto,
  ResetPasswordDto,
  UpdateUserDto,
  UserQueryDto,
  UserView,
} from './dto/user.dto.js';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator.js';
import { UserService } from './user.service.js';

@ApiTags('用户管理')
@ApiStandardErrors()
@Controller('system/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @RequirePermissions('system:user:query')
  @ApiOperation({ summary: '用户分页', operationId: 'listUsers' })
  @ApiOkPage(UserView)
  findPage(@Query() query: UserQueryDto) {
    return this.userService.findPage(query);
  }

  @Post()
  @RequirePermissions('system:user:create')
  @ApiOperation({ summary: '新增用户', operationId: 'createUser' })
  @ApiCreatedData(UserView)
  create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Put(':id/password')
  @RequirePermissions('system:user:resetPwd')
  @ApiOperation({ summary: '重置密码', operationId: 'resetUserPassword' })
  @ApiOkEmpty()
  resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.userService.resetPassword(id, dto);
  }

  @Put(':id')
  @RequirePermissions('system:user:update')
  @ApiOperation({ summary: '编辑用户', operationId: 'updateUser' })
  @ApiOkData(UserView)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.userService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('system:user:delete')
  @ApiOperation({ summary: '删除用户', operationId: 'deleteUser' })
  @ApiOkEmpty()
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }
}
