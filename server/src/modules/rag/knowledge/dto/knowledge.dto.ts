import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { KnowledgeVisibility } from '@prisma/client';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../../../common/dto/page.dto.js';
import { BlankToUndefined, Trim } from '../../../../common/dto/transforms.js';

export class KnowledgeQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '名称或描述' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @BlankToUndefined()
  name?: string;
}

export class KnowledgePayloadDto {
  @ApiProperty({ maxLength: 40 })
  @IsString()
  @IsNotEmpty({ message: '请填写知识库名称' })
  @MaxLength(40, { message: '知识库名称不能超过 40 个字' })
  @Trim()
  name!: string;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MaxLength(200, { message: '描述不能超过 200 个字' })
  @Trim()
  description!: string;
}

export class KnowledgeView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ enum: KnowledgeVisibility, enumName: 'KnowledgeVisibility' })
  visibility!: KnowledgeVisibility;

  @ApiProperty()
  ownerId!: string;

  @ApiProperty()
  ownerName!: string;

  @ApiProperty()
  documentCount!: number;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  updatedAt!: string;
}
