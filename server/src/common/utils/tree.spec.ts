import {
  buildTree,
  collectDescendantIds,
  createsCycle,
  keepWithAncestors,
} from './tree.js';

describe('tree', () => {
  const nodes = [
    { id: 'c1', parentId: null, sort: 2, name: '集团' },
    { id: 'c2', parentId: 'c1', sort: 1, name: '研发' },
    { id: 'c3', parentId: 'c1', sort: 2, name: '销售' },
  ];

  it('builds a sorted tree and drops empty children', () => {
    const tree = buildTree(nodes);
    expect(tree.map((item) => item.id)).toEqual(['c1']);
    expect(tree[0].children?.map((item) => item.id)).toEqual(['c2', 'c3']);
    expect(tree[0].children?.[0].children).toBeUndefined();
  });

  it('keeps ancestors of matched nodes', () => {
    const matched = nodes.filter((item) => item.id === 'c3');
    expect(keepWithAncestors(nodes, matched).map((item) => item.id)).toEqual([
      'c3',
      'c1',
    ]);
  });

  it('detects a parent that sits in the subtree', () => {
    expect(createsCycle(nodes, 'c1', 'c3')).toBe(true);
    expect(createsCycle(nodes, 'c3', 'c1')).toBe(false);
    expect(createsCycle(nodes, 'c2', null)).toBe(false);
    expect(createsCycle(nodes, 'c2', 'c2')).toBe(true);
  });

  it('collects descendants', () => {
    expect(collectDescendantIds(nodes, 'c1')).toEqual(['c2', 'c3']);
    expect(collectDescendantIds(nodes, 'c2')).toEqual([]);
  });
});
