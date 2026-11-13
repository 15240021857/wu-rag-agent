import { KnowledgeVisibility } from '@prisma/client';
import { knowledgeAccessWhere } from './knowledge-access.js';

describe('knowledgeAccessWhere', () => {
  it('includes public knowledge, the owner, and a custom whitelist', () => {
    expect(knowledgeAccessWhere({ id: 'u1', deptId: 'd1' })).toEqual({
      OR: [
        { visibility: KnowledgeVisibility.PUBLIC },
        { ownerId: 'u1' },
        {
          visibility: KnowledgeVisibility.CUSTOM,
          users: { some: { userId: 'u1' } },
        },
        {
          visibility: KnowledgeVisibility.CUSTOM,
          depts: { some: { deptId: 'd1' } },
        },
      ],
    });
  });
});
