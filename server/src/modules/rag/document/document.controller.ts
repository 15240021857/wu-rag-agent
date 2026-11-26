import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
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
  DocumentService,
  MAX_DOCUMENT_BYTES,
  type DocumentFile,
} from './document.service.js';
import {
  ChunkSettingsDto,
  DocumentChunkView,
  DocumentDetailView,
  DocumentQueryDto,
  DocumentView,
  UploadDocumentDto,
} from './dto/document.dto.js';

const uploadDocument = FileInterceptor('file', {
  limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1 },
  defParamCharset: 'utf8',
});

@ApiTags('文档管理')
@ApiStandardErrors()
@Controller('rag/documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Get()
  @RequirePermissions('rag:document:query', 'rag:chat:query')
  @ApiOperation({ summary: '文档分页', operationId: 'listDocuments' })
  @ApiOkPage(DocumentView)
  findPage(@CurrentUser() user: AuthUser, @Query() query: DocumentQueryDto) {
    return this.documentService.findPage(user, query);
  }

  @Post()
  @RequirePermissions('rag:document:create')
  @UseInterceptors(uploadDocument)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'knowledgeId'],
      properties: {
        file: { type: 'string', format: 'binary' },
        knowledgeId: { type: 'string' },
      },
    },
  })
  @ApiOperation({
    summary: '上传文档',
    description:
      '支持 txt、md、markdown、pdf、docx、xlsx、csv、ppt。PDF 含扫描件。',
    operationId: 'createDocument',
  })
  @ApiCreatedData(DocumentView, '上传完成，等待向量化')
  create(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: DocumentFile | undefined,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.documentService.create(user, dto.knowledgeId, file);
  }

  @Get(':id/detail')
  @RequirePermissions('rag:document:query')
  @ApiOperation({ summary: '文档原文和分片', operationId: 'getDocumentDetail' })
  @ApiExtraModels(DocumentChunkView)
  @ApiOkData(DocumentDetailView)
  findDetail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.documentService.findDetail(user, id);
  }

  @Post(':id/vectorize')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('rag:document:update')
  @ApiOperation({
    summary: '按新分片重新入库',
    operationId: 'revectorizeDocument',
  })
  @ApiOkData(DocumentView)
  revectorize(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ChunkSettingsDto,
  ) {
    return this.documentService.revectorize(user, id, dto);
  }

  @Get(':id')
  @RequirePermissions('rag:document:query', 'rag:chat:query')
  @ApiOperation({ summary: '文档详情', operationId: 'getDocument' })
  @ApiOkData(DocumentView)
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.documentService.findOne(user, id);
  }

  @Delete(':id')
  @RequirePermissions('rag:document:delete')
  @ApiOperation({ summary: '删除文档', operationId: 'deleteDocument' })
  @ApiOkEmpty()
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.documentService.remove(user, id);
  }
}
