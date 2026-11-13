import { Module } from '@nestjs/common';
import { CompanyModule } from './company/company.module.js';
import { DeptModule } from './dept/dept.module.js';
import { MenuModule } from './menu/menu.module.js';
import { RoleModule } from './role/role.module.js';
import { UserModule } from './user/user.module.js';

@Module({
  imports: [CompanyModule, DeptModule, UserModule, RoleModule, MenuModule],
})
export class SystemModule {}
