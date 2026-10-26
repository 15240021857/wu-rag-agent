export interface TreeSource {
  id: string
  parentId: string | null
  sort: number
}

export type TreeNode<T> = T & { children?: TreeNode<T>[] }

export function buildTree<T extends TreeSource>(items: T[]): TreeNode<T>[] {
  const nodes = new Map<string, TreeNode<T>>()
  for (const item of items) {
    const copy = { ...item } as TreeNode<T>
    delete copy.children
    nodes.set(item.id, copy)
  }
  const roots: TreeNode<T>[] = []
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined
    if (parent) {
      parent.children = parent.children ?? []
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sortNodes = (list: TreeNode<T>[]) => {
    list.sort((a, b) => a.sort - b.sort)
    for (const node of list) {
      if (node.children?.length) sortNodes(node.children)
      else delete node.children
    }
  }
  sortNodes(roots)
  return roots
}

export function withAncestors<T extends { id: string; parentId: string | null }>(
  matched: Set<string>,
  all: T[],
): Set<string> {
  const map = new Map(all.map((item) => [item.id, item]))
  const result = new Set(matched)
  for (const id of matched) {
    let current = map.get(id)
    while (current?.parentId) {
      result.add(current.parentId)
      current = map.get(current.parentId)
    }
  }
  return result
}

export function descendantIds<T extends { id: string; parentId: string | null }>(
  rootId: string,
  all: T[],
): Set<string> {
  const result = new Set<string>()
  const walk = (parentId: string) => {
    for (const item of all) {
      if (item.parentId === parentId) {
        result.add(item.id)
        walk(item.id)
      }
    }
  }
  walk(rootId)
  return result
}

export function paginate<T>(list: T[], pageNum: number, pageSize: number) {
  const start = (pageNum - 1) * pageSize
  return {
    list: list.slice(start, start + pageSize),
    total: list.length,
    pageNum,
    pageSize,
  }
}
