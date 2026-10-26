export interface TreeSource {
  id: string
  parentId: string | null
  sort?: number
}

export type TreeItem<T> = T & { children?: TreeItem<T>[] }

export function buildTree<T extends TreeSource>(items: T[]): TreeItem<T>[] {
  const nodes = new Map<string, TreeItem<T>>()
  for (const item of items) {
    const copy = { ...item } as TreeItem<T>
    delete copy.children
    nodes.set(item.id, copy)
  }
  const roots: TreeItem<T>[] = []
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined
    if (parent) {
      parent.children = parent.children ?? []
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sortNodes = (list: TreeItem<T>[]) => {
    list.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    for (const node of list) {
      if (node.children?.length) sortNodes(node.children)
      else delete node.children
    }
  }
  sortNodes(roots)
  return roots
}

export function flattenTree<T extends { children?: T[] }>(nodes: T[]): T[] {
  const result: T[] = []
  const walk = (list: T[]) => {
    for (const node of list) {
      result.push(node)
      if (node.children?.length) walk(node.children)
    }
  }
  walk(nodes)
  return result
}

export function descendantIds<T extends { id: string; children?: T[] }>(
  nodes: T[],
  rootId: string,
): Set<string> {
  const result = new Set<string>()
  const walk = (list: T[], capture: boolean) => {
    for (const node of list) {
      const next = capture || node.id === rootId
      if (capture) result.add(node.id)
      if (node.children?.length) walk(node.children, next)
    }
  }
  walk(nodes, false)
  return result
}
