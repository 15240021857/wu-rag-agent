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
  ApiOkList,
  ApiStandardErrors,
} from '../../../common/swagger/api-response.js';
import { MenuPayloadDto, MenuQueryDto, MenuView } from './dto/menu.dto.js';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator.js';
import { MenuService } from './menu.service.js';

@ApiTags('菜单管理')
@ApiStandardErrors()
@Controller('system/menus')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get()
  @RequirePermissions('system:menu:query', 'system:role:update')
  @ApiOperation({
    summary: '菜单树',
    description: '返回树。筛选时保留命中节点的上级。',
    operationId: 'listMenus',
  })
  @ApiOkList(MenuView)
  findAll(@Query() query: MenuQueryDto) {
    return this.menuService.findAll(query);
  }

  @Post()
  @RequirePermissions('system:menu:create')
  @ApiOperation({ summary: '新增菜单', operationId: 'createMenu' })
  @ApiCreatedData(MenuView)
  create(@Body() dto: MenuPayloadDto) {
    return this.menuService.create(dto);
  }

  @Put(':id')
  @RequirePermissions('system:menu:update')
  @ApiOperation({ summary: '编辑菜单', operationId: 'updateMenu' })
  @ApiOkData(MenuView)
  update(@Param('id') id: string, @Body() dto: MenuPayloadDto) {
    return this.menuService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('system:menu:delete')
  @ApiOperation({ summary: '删除菜单', operationId: 'deleteMenu' })
  @ApiOkEmpty()
  remove(@Param('id') id: string) {
    return this.menuService.remove(id);
  }
}
