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
import { RequirePermissions } from '../../auth/decorators/permissions.decorator.js';
import { DeptService } from './dept.service.js';
import { DeptPayloadDto, DeptQueryDto, DeptView } from './dto/dept.dto.js';

@ApiTags('部门管理')
@ApiStandardErrors()
@Controller('system/depts')
export class DeptController {
  constructor(private readonly deptService: DeptService) {}

  @Get()
  @RequirePermissions('system:dept:query', 'system:user:query')
  @ApiOperation({
    summary: '部门树',
    description: 'list 为树。筛选时保留命中节点的上级，total 为节点数。',
    operationId: 'listDepts',
  })
  @ApiOkPage(DeptView)
  findPage(@Query() query: DeptQueryDto) {
    return this.deptService.findPage(query);
  }

  @Post()
  @RequirePermissions('system:dept:create')
  @ApiOperation({ summary: '新增部门', operationId: 'createDept' })
  @ApiCreatedData(DeptView)
  create(@Body() dto: DeptPayloadDto) {
    return this.deptService.create(dto);
  }

  @Put(':id')
  @RequirePermissions('system:dept:update')
  @ApiOperation({ summary: '编辑部门', operationId: 'updateDept' })
  @ApiOkData(DeptView)
  update(@Param('id') id: string, @Body() dto: DeptPayloadDto) {
    return this.deptService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('system:dept:delete')
  @ApiOperation({ summary: '删除部门', operationId: 'deleteDept' })
  @ApiOkEmpty()
  remove(@Param('id') id: string) {
    return this.deptService.remove(id);
  }
}
