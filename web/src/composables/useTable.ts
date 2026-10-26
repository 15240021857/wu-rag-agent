import type { PageQuery, PageResult } from '@/types/api'
import { reactive, ref } from 'vue'

export function useTable<T, Q extends PageQuery>(
  fetcher: (query: Q) => Promise<PageResult<T>>,
  createQuery: () => Q,
) {
  const loading = ref(false)
  const list = ref<T[]>([])
  const total = ref(0)
  const query = reactive(createQuery()) as Q

  async function load() {
    loading.value = true
    try {
      const result = await fetcher(query)
      list.value = result.list
      total.value = result.total
      query.pageNum = result.pageNum
      query.pageSize = result.pageSize
    } catch {
      list.value = []
      total.value = 0
    } finally {
      loading.value = false
    }
  }

  function search() {
    query.pageNum = 1
    return load()
  }

  function reset() {
    Object.assign(query, createQuery())
    return load()
  }

  function onPageChange(pageNum: number, pageSize: number) {
    query.pageNum = pageNum
    query.pageSize = pageSize
    return load()
  }

  return { loading, list, total, query, load, search, reset, onPageChange }
}
