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
import type { AuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator.js';
import {
  KnowledgePayloadDto,
  KnowledgeQueryDto,
  KnowledgeView,
} from './dto/knowledge.dto.js';
import { KnowledgeService } from './knowledge.service.js';

@ApiTags('知识库管理')
@ApiStandardErrors()
@Controller('rag/knowledges')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  @RequirePermissions('rag:knowledge:query', 'rag:chat:query')
  @ApiOperation({ summary: '知识库分页', operationId: 'listKnowledges' })
  @ApiOkPage(KnowledgeView)
  findPage(@CurrentUser() user: AuthUser, @Query() query: KnowledgeQueryDto) {
    return this.knowledgeService.findPage(user, query);
  }

  @Post()
  @RequirePermissions('rag:knowledge:create')
  @ApiOperation({ summary: '新增知识库', operationId: 'createKnowledge' })
  @ApiCreatedData(KnowledgeView)
  create(@CurrentUser() user: AuthUser, @Body() dto: KnowledgePayloadDto) {
    return this.knowledgeService.create(user, dto);
  }

  @Put(':id')
  @RequirePermissions('rag:knowledge:update')
  @ApiOperation({ summary: '编辑知识库', operationId: 'updateKnowledge' })
  @ApiOkData(KnowledgeView)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: KnowledgePayloadDto,
  ) {
    return this.knowledgeService.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('rag:knowledge:delete')
  @ApiOperation({ summary: '删除知识库', operationId: 'deleteKnowledge' })
  @ApiOkEmpty()
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.knowledgeService.remove(user, id);
  }
}
