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
  RoleMenuDto,
  RolePayloadDto,
  RoleQueryDto,
  RoleView,
} from './dto/role.dto.js';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator.js';
import { RoleService } from './role.service.js';

@ApiTags('角色管理')
@ApiStandardErrors()
@Controller('system/roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @RequirePermissions('system:role:query', 'system:user:query')
  @ApiOperation({ summary: '角色分页', operationId: 'listRoles' })
  @ApiOkPage(RoleView)
  findPage(@Query() query: RoleQueryDto) {
    return this.roleService.findPage(query);
  }

  @Post()
  @RequirePermissions('system:role:create')
  @ApiOperation({ summary: '新增角色', operationId: 'createRole' })
  @ApiCreatedData(RoleView)
  create(@Body() dto: RolePayloadDto) {
    return this.roleService.create(dto);
  }

  @Put(':id/menus')
  @RequirePermissions('system:role:update')
  @ApiOperation({ summary: '角色授权', operationId: 'updateRoleMenus' })
  @ApiOkData(RoleView)
  updateMenus(@Param('id') id: string, @Body() dto: RoleMenuDto) {
    return this.roleService.updateMenus(id, dto);
  }

  @Put(':id')
  @RequirePermissions('system:role:update')
  @ApiOperation({ summary: '编辑角色', operationId: 'updateRole' })
  @ApiOkData(RoleView)
  update(@Param('id') id: string, @Body() dto: RolePayloadDto) {
    return this.roleService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('system:role:delete')
  @ApiOperation({ summary: '删除角色', operationId: 'deleteRole' })
  @ApiOkEmpty()
  remove(@Param('id') id: string) {
    return this.roleService.remove(id);
  }
}
