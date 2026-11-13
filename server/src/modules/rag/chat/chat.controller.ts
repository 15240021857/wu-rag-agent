import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import {
  ApiOkData,
  ApiOkEmpty,
  ApiOkList,
  ApiStandardErrors,
} from '../../../common/swagger/api-response.js';
import type { AuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator.js';
import { ChatService } from './chat.service.js';
import {
  ChatMessageView,
  ChatPayloadDto,
  CitationView,
  ConversationDetailView,
  ConversationSummaryView,
} from './dto/chat.dto.js';

@ApiTags('知识库问答')
@ApiStandardErrors()
@Controller('rag')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  @RequirePermissions('rag:chat:query')
  @ApiOperation({ summary: '我的对话', operationId: 'listConversations' })
  @ApiOkList(ConversationSummaryView)
  list(@CurrentUser() user: AuthUser) {
    return this.chatService.list(user);
  }

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('rag:chat:query')
  @ApiOperation({ summary: '提问', operationId: 'sendChat' })
  @ApiProduces('text/event-stream')
  async ask(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChatPayloadDto,
    @Res() res: Response,
  ) {
    await this.chatService.ask(user, dto, res);
  }

  @Get('conversations/:id')
  @RequirePermissions('rag:chat:query')
  @ApiOperation({ summary: '对话详情', operationId: 'getConversation' })
  @ApiExtraModels(ChatMessageView, CitationView)
  @ApiOkData(ConversationDetailView)
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.chatService.findOne(user, id);
  }

  @Delete('conversations/:id')
  @RequirePermissions('rag:chat:query')
  @ApiOperation({ summary: '删除对话', operationId: 'deleteConversation' })
  @ApiOkEmpty()
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.chatService.remove(user, id);
  }
}
