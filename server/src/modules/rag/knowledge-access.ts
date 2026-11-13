import { KnowledgeVisibility, type Prisma } from '@prisma/client';

/** 公开、作者本人，以及自定义可见范围里的部门或用户白名单。 */
export function knowledgeAccessWhere(user: {
  id: string;
  deptId: string;
}): Prisma.KnowledgeWhereInput {
  return {
    OR: [
      { visibility: KnowledgeVisibility.PUBLIC },
      { ownerId: user.id },
      {
        visibility: KnowledgeVisibility.CUSTOM,
        users: { some: { userId: user.id } },
      },
      {
        visibility: KnowledgeVisibility.CUSTOM,
        depts: { some: { deptId: user.deptId } },
      },
    ],
  };
}
