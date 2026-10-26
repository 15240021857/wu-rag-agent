import type { PageResult } from '@/types/api'
import type { Company, CompanyPayload, CompanyQuery } from '@/types/system'
import { http } from '@/utils/request'

export function fetchCompanies(params: CompanyQuery) {
  return http<PageResult<Company>>({ url: '/system/companies', method: 'GET', params })
}

export function createCompany(data: CompanyPayload) {
  return http<Company>({ url: '/system/companies', method: 'POST', data })
}

export function updateCompany(id: string, data: CompanyPayload) {
  return http<Company>({ url: `/system/companies/${id}`, method: 'PUT', data })
}

export function deleteCompany(id: string) {
  return http<null>({ url: `/system/companies/${id}`, method: 'DELETE' })
}
