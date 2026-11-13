import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChunkMethod, VectorStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PageQueryDto } from '../../../../common/dto/page.dto.js';
import { BlankToUndefined, Trim } from '../../../../common/dto/transforms.js';

export class DocumentQueryDto extends PageQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @BlankToUndefined()
  knowledgeId?: string;

  @ApiPropertyOptional({ description: '文件名' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @BlankToUndefined()
  fileName?: string;

  @ApiPropertyOptional({ enum: VectorStatus, enumName: 'VectorStatus' })
  @IsOptional()
  @IsEnum(VectorStatus, { message: '向量化状态不正确' })
  @BlankToUndefined()
  vectorStatus?: VectorStatus;
}

export class ChunkContentDto {
  @ApiProperty()
  @IsString()
  content!: string;
}

export class ChunkSettingsDto {
  @ApiProperty({ enum: ChunkMethod, enumName: 'ChunkMethod' })
  @IsEnum(ChunkMethod, { message: '切分方式不正确' })
  chunkMethod!: ChunkMethod;

  @ApiProperty({ description: '按字符切分时必填，例如 \\n' })
  @IsString()
  @MaxLength(20, { message: '切分字符过长' })
  chunkSeparator!: string;

  @ApiProperty({ minimum: 100, maximum: 4000 })
  @Type(() => Number)
  @IsInt({ message: '最大分片字符数必须是整数' })
  @Min(100, { message: '最大分片字符数需在 100 到 4000 之间' })
  @Max(4000, { message: '最大分片字符数需在 100 到 4000 之间' })
  chunkSize!: number;

  @ApiProperty({ type: [ChunkContentDto] })
  @IsArray()
  @ArrayMinSize(1, { message: '请先生成分片' })
  @ArrayMaxSize(2000, { message: '请先生成分片' })
  @ValidateNested({ each: true })
  @Type(() => ChunkContentDto)
  chunks!: ChunkContentDto[];
}

export class UploadDocumentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: '请选择知识库' })
  @MaxLength(64)
  @Trim()
  knowledgeId!: string;
}

export class DocumentChunkView {
  @ApiProperty()
  index!: number;

  @ApiProperty()
  content!: string;

  @ApiProperty()
  charCount!: number;
}

export class DocumentView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  knowledgeId!: string;

  @ApiProperty()
  knowledgeName!: string;

  @ApiProperty()
  fileName!: string;

  @ApiProperty()
  fileType!: string;

  @ApiProperty()
  size!: number;

  @ApiProperty({ enum: ChunkMethod, enumName: 'ChunkMethod' })
  chunkMethod!: ChunkMethod;

  @ApiProperty()
  chunkSeparator!: string;

  @ApiProperty()
  chunkSize!: number;

  @ApiProperty()
  chunkCount!: number;

  @ApiProperty({ enum: VectorStatus, enumName: 'VectorStatus' })
  vectorStatus!: VectorStatus;

  @ApiProperty()
  ready!: boolean;

  @ApiProperty()
  progress!: number;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  updatedAt!: string;
}

export class DocumentDetailView extends DocumentView {
  @ApiProperty()
  content!: string;

  @ApiProperty({ type: () => [DocumentChunkView] })
  chunks!: DocumentChunkView[];
}
