import { Module } from '@nestjs/common';
import { KnowledgeAccessService } from './knowledge-access.service.js';
import { KnowledgeController } from './knowledge.controller.js';
import { KnowledgeService } from './knowledge.service.js';

@Module({
  controllers: [KnowledgeController],
  providers: [KnowledgeService, KnowledgeAccessService],
  exports: [KnowledgeAccessService],
})
export class KnowledgeModule {}
