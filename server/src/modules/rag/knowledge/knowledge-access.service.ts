import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import type { AuthUser } from '../../auth/auth.types.js';
import { knowledgeAccessWhere } from '../knowledge-access.js';

@Injectable()
export class KnowledgeAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requireReadable(
    id: string,
    user: AuthUser,
    missingMessage: string,
    deniedMessage: string,
  ) {
    const knowledge = await this.prisma.knowledge.findFirst({
      where: { id, ...knowledgeAccessWhere(user) },
      select: { id: true, name: true },
    });
    if (knowledge) return knowledge;
    const exists = await this.prisma.knowledge.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(missingMessage);
    throw new ForbiddenException(deniedMessage);
  }
}
