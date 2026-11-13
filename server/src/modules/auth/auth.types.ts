import type { DataScope } from '@prisma/client';

export interface AccessTokenPayload {
  sub: string;
  username: string;
}

/** 守卫挂到请求上的登录用户。权限和数据范围每次请求从库里重算。 */
export interface AuthUser {
  id: string;
  username: string;
  companyId: string;
  deptId: string;
  permissions: string[];
  dataScope: DataScope;
}
