import { Module } from '@nestjs/common';
import { ChatModule } from './chat/chat.module.js';
import { DocumentModule } from './document/document.module.js';
import { KnowledgeModule } from './knowledge/knowledge.module.js';

@Module({
  imports: [KnowledgeModule, DocumentModule, ChatModule],
})
export class RagModule {}
