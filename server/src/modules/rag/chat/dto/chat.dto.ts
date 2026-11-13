import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageRole } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { BlankToUndefined, Trim } from '../../../../common/dto/transforms.js';

export class ChatMessageDto {
  @ApiProperty({ enum: MessageRole, enumName: 'MessageRole' })
  @IsEnum(MessageRole, { message: '消息角色不正确' })
  role!: MessageRole;

  @ApiProperty({ maxLength: 4000 })
  @IsString()
  @MaxLength(4000, { message: '单条消息不能超过 4000 字' })
  content!: string;
}

export class ChatPayloadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @BlankToUndefined()
  conversationId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: '请选择知识库' })
  @MaxLength(64)
  @Trim()
  knowledgeId!: string;

  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @MaxLength(2000, { message: '系统提示词不能超过 2000 字' })
  @Trim()
  systemPrompt!: string;

  @ApiProperty({ type: [ChatMessageDto] })
  @IsArray()
  @ArrayMinSize(1, { message: '请输入问题' })
  @ArrayMaxSize(40, { message: '请输入问题' })
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];
}

export class CitationView {
  @ApiProperty()
  documentId!: string;

  @ApiProperty()
  documentName!: string;

  @ApiProperty()
  chunkIndex!: number;

  @ApiProperty()
  content!: string;
}

export class ChatMessageView {
  @ApiProperty({ enum: MessageRole, enumName: 'MessageRole' })
  role!: MessageRole;

  @ApiProperty()
  content!: string;

  @ApiPropertyOptional({ type: () => [CitationView] })
  citations?: CitationView[];
}

export class ConversationSummaryView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  knowledgeId!: string;

  @ApiProperty()
  knowledgeName!: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  updatedAt!: string;
}

export class ConversationDetailView extends ConversationSummaryView {
  @ApiProperty()
  systemPrompt!: string;

  @ApiProperty({ type: () => [ChatMessageView] })
  messages!: ChatMessageView[];
}
