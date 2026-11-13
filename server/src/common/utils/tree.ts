export interface FlatNode {
  id: string;
  parentId: string | null;
  sort: number;
  name?: string;
}

export type TreeNode<T> = T & { children?: TreeNode<T>[] };

export function buildTree<T extends FlatNode>(items: T[]): TreeNode<T>[] {
  const nodes = new Map<string, TreeNode<T>>();
  for (const item of items) {
    const copy = { ...item } as TreeNode<T>;
    delete copy.children;
    nodes.set(item.id, copy);
  }

  const roots: TreeNode<T>[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) {
      parent.children = parent.children ?? [];
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (list: TreeNode<T>[]) => {
    list.sort(
      (a, b) =>
        a.sort - b.sort ||
        (a.name ?? '').localeCompare(b.name ?? '', 'zh') ||
        a.id.localeCompare(b.id),
    );
    for (const node of list) {
      if (node.children?.length) sortNodes(node.children);
      else delete node.children;
    }
  };
  sortNodes(roots);
  return roots;
}

export function keepWithAncestors<
  T extends { id: string; parentId: string | null },
>(all: T[], matched: T[]): T[] {
  const byId = new Map(all.map((item) => [item.id, item]));
  const kept = new Map<string, T>();
  for (const item of matched) {
    let current: T | undefined = item;
    const guard = new Set<string>();
    while (current && !guard.has(current.id)) {
      guard.add(current.id);
      kept.set(current.id, current);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
  }
  return [...kept.values()];
}

export function createsCycle(
  nodes: Array<{ id: string; parentId: string | null }>,
  id: string,
  nextParentId: string | null,
): boolean {
  if (!nextParentId) return false;
  if (nextParentId === id) return true;
  const parentOf = new Map(nodes.map((item) => [item.id, item.parentId]));
  let current: string | null = nextParentId;
  const guard = new Set<string>();
  while (current && !guard.has(current)) {
    if (current === id) return true;
    guard.add(current);
    current = parentOf.get(current) ?? null;
  }
  return false;
}

export function collectDescendantIds(
  nodes: Array<{ id: string; parentId: string | null }>,
  rootId: string,
): string[] {
  const children = new Map<string, string[]>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const list = children.get(node.parentId) ?? [];
    list.push(node.id);
    children.set(node.parentId, list);
  }
  const result: string[] = [];
  const walk = (currentId: string) => {
    for (const childId of children.get(currentId) ?? []) {
      result.push(childId);
      walk(childId);
    }
  };
  walk(rootId);
  return result;
}

export function countNodes<T extends { children?: T[] }>(nodes: T[]): number {
  let total = 0;
  for (const node of nodes) total += 1 + countNodes(node.children ?? []);
  return total;
}
