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
import { CompanyService } from './company.service.js';
import {
  CompanyPayloadDto,
  CompanyQueryDto,
  CompanyView,
} from './dto/company.dto.js';

@ApiTags('公司管理')
@ApiStandardErrors()
@Controller('system/companies')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get()
  @RequirePermissions(
    'system:company:query',
    'system:dept:query',
    'system:user:query',
  )
  @ApiOperation({
    summary: '公司树',
    description: 'list 为树。筛选时保留命中节点的上级，total 为节点数。',
    operationId: 'listCompanies',
  })
  @ApiOkPage(CompanyView)
  findPage(@Query() query: CompanyQueryDto) {
    return this.companyService.findPage(query);
  }

  @Post()
  @RequirePermissions('system:company:create')
  @ApiOperation({ summary: '新增公司', operationId: 'createCompany' })
  @ApiCreatedData(CompanyView)
  create(@Body() dto: CompanyPayloadDto) {
    return this.companyService.create(dto);
  }

  @Put(':id')
  @RequirePermissions('system:company:update')
  @ApiOperation({ summary: '编辑公司', operationId: 'updateCompany' })
  @ApiOkData(CompanyView)
  update(@Param('id') id: string, @Body() dto: CompanyPayloadDto) {
    return this.companyService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('system:company:delete')
  @ApiOperation({ summary: '删除公司', operationId: 'deleteCompany' })
  @ApiOkEmpty()
  remove(@Param('id') id: string) {
    return this.companyService.remove(id);
  }
}
