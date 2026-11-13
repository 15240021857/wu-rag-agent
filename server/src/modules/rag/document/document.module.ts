import { Module } from '@nestjs/common';
import { KnowledgeModule } from '../knowledge/knowledge.module.js';
import { DocumentController } from './document.controller.js';
import { DocumentService } from './document.service.js';
import { IngestQueue } from './ingest.queue.js';

@Module({
  imports: [KnowledgeModule],
  controllers: [DocumentController],
  providers: [DocumentService, IngestQueue],
})
export class DocumentModule {}
