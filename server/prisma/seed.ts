import { DataScope, MenuType, PrismaClient, Status } from '@prisma/client';
import { hashPassword } from '../src/common/utils/password.js';

const prisma = new PrismaClient();

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = '123456';

interface MenuSeed {
  id: string;
  parentId: string | null;
  name: string;
  path: string;
  component: string;
  icon: string;
  sort: number;
  type: MenuType;
  permission: string;
}

function button(
  id: string,
  parentId: string,
  name: string,
  permission: string,
  sort: number,
): MenuSeed {
  return {
    id,
    parentId,
    name,
    path: '',
    component: '',
    icon: '',
    sort,
    type: MenuType.BUTTON,
    permission,
  };
}

const menus: MenuSeed[] = [
  {
    id: 'm_dashboard',
    parentId: null,
    name: '工作台',
    path: '/dashboard',
    component: 'dashboard/index',
    icon: 'DashboardOutlined',
    sort: 1,
    type: MenuType.MENU,
    permission: '',
  },
  {
    id: 'm_rag_chat',
    parentId: null,
    name: '知识库问答',
    path: '/chat',
    component: 'rag/chat/index',
    icon: 'CommentOutlined',
    sort: 2,
    type: MenuType.MENU,
    permission: 'rag:chat:query',
  },
  button('b_kb_create', 'm_rag_chat', '新增知识库', 'rag:knowledge:create', 1),
  button('b_doc_create', 'm_rag_chat', '新增文档', 'rag:document:create', 2),
  {
    id: 'm_rag',
    parentId: null,
    name: '知识库管理',
    path: '/rag',
    component: '',
    icon: 'BookOutlined',
    sort: 3,
    type: MenuType.DIR,
    permission: '',
  },
  {
    id: 'm_kb',
    parentId: 'm_rag',
    name: '知识库管理',
    path: '/rag/knowledge',
    component: 'rag/knowledge/index',
    icon: 'ReadOutlined',
    sort: 1,
    type: MenuType.MENU,
    permission: 'rag:knowledge:query',
  },
  button('b_kb_update', 'm_kb', '编辑知识库', 'rag:knowledge:update', 1),
  button('b_kb_delete', 'm_kb', '删除知识库', 'rag:knowledge:delete', 2),
  {
    id: 'm_doc',
    parentId: 'm_rag',
    name: '文档管理',
    path: '/rag/document',
    component: 'rag/document/index',
    icon: 'FileTextOutlined',
    sort: 2,
    type: MenuType.MENU,
    permission: 'rag:document:query',
  },
  button('b_doc_update', 'm_doc', '重新向量化', 'rag:document:update', 1),
  button('b_doc_delete', 'm_doc', '删除文档', 'rag:document:delete', 2),
  {
    id: 'm_system',
    parentId: null,
    name: '系统管理',
    path: '/system',
    component: '',
    icon: 'SettingOutlined',
    sort: 4,
    type: MenuType.DIR,
    permission: '',
  },
  {
    id: 'm_user',
    parentId: 'm_system',
    name: '用户管理',
    path: '/system/user',
    component: 'system/user/index',
    icon: 'UserOutlined',
    sort: 1,
    type: MenuType.MENU,
    permission: 'system:user:query',
  },
  button('b_user_create', 'm_user', '新增用户', 'system:user:create', 1),
  button('b_user_update', 'm_user', '编辑用户', 'system:user:update', 2),
  button('b_user_delete', 'm_user', '删除用户', 'system:user:delete', 3),
  button('b_user_reset', 'm_user', '重置密码', 'system:user:resetPwd', 4),
  {
    id: 'm_company',
    parentId: 'm_system',
    name: '公司管理',
    path: '/system/company',
    component: 'system/company/index',
    icon: 'BankOutlined',
    sort: 2,
    type: MenuType.MENU,
    permission: 'system:company:query',
  },
  button(
    'b_company_create',
    'm_company',
    '新增公司',
    'system:company:create',
    1,
  ),
  button(
    'b_company_update',
    'm_company',
    '编辑公司',
    'system:company:update',
    2,
  ),
  button(
    'b_company_delete',
    'm_company',
    '删除公司',
    'system:company:delete',
    3,
  ),
  {
    id: 'm_dept',
    parentId: 'm_system',
    name: '部门管理',
    path: '/system/dept',
    component: 'system/dept/index',
    icon: 'ApartmentOutlined',
    sort: 3,
    type: MenuType.MENU,
    permission: 'system:dept:query',
  },
  button('b_dept_create', 'm_dept', '新增部门', 'system:dept:create', 1),
  button('b_dept_update', 'm_dept', '编辑部门', 'system:dept:update', 2),
  button('b_dept_delete', 'm_dept', '删除部门', 'system:dept:delete', 3),
  {
    id: 'm_role',
    parentId: 'm_system',
    name: '角色管理',
    path: '/system/role',
    component: 'system/role/index',
    icon: 'SafetyCertificateOutlined',
    sort: 4,
    type: MenuType.MENU,
    permission: 'system:role:query',
  },
  button('b_role_create', 'm_role', '新增角色', 'system:role:create', 1),
  button('b_role_update', 'm_role', '编辑角色', 'system:role:update', 2),
  button('b_role_delete', 'm_role', '删除角色', 'system:role:delete', 3),
  {
    id: 'm_menu',
    parentId: 'm_system',
    name: '菜单管理',
    path: '/system/menu',
    component: 'system/menu/index',
    icon: 'MenuOutlined',
    sort: 5,
    type: MenuType.MENU,
    permission: 'system:menu:query',
  },
  button('b_menu_create', 'm_menu', '新增菜单', 'system:menu:create', 1),
  button('b_menu_update', 'm_menu', '编辑菜单', 'system:menu:update', 2),
  button('b_menu_delete', 'm_menu', '删除菜单', 'system:menu:delete', 3),
];

async function main() {
  const passwordHash = await hashPassword(ADMIN_PASSWORD);

  const created = await prisma.$transaction(async (tx) => {
    const company = await tx.company.upsert({
      where: { code: 'AH' },
      update: { name: '安徽公司', status: Status.NORMAL },
      create: {
        name: '安徽公司',
        code: 'AH',
        sort: 1,
        status: Status.NORMAL,
      },
    });

    const dept = await tx.dept.upsert({
      where: { companyId_code: { companyId: company.id, code: 'QG' } },
      update: { name: '企管部', status: Status.NORMAL },
      create: {
        name: '企管部',
        code: 'QG',
        companyId: company.id,
        sort: 1,
        status: Status.NORMAL,
      },
    });

    for (const menu of menus) {
      const data = {
        parentId: menu.parentId,
        name: menu.name,
        path: menu.path,
        component: menu.component,
        icon: menu.icon,
        sort: menu.sort,
        type: menu.type,
        permission: menu.permission,
      };
      await tx.menu.upsert({
        where: { id: menu.id },
        update: data,
        create: { id: menu.id, ...data },
      });
    }

    const role = await tx.role.upsert({
      where: { code: 'SUPER_ADMIN' },
      update: {
        name: '超级管理员',
        dataScope: DataScope.ALL,
        status: Status.NORMAL,
        sort: 1,
      },
      create: {
        name: '超级管理员',
        code: 'SUPER_ADMIN',
        dataScope: DataScope.ALL,
        status: Status.NORMAL,
        sort: 1,
        remark: '系统全部权限',
      },
    });

    await tx.roleMenu.createMany({
      data: menus.map((menu) => ({ roleId: role.id, menuId: menu.id })),
      skipDuplicates: true,
    });

    const existing = await tx.user.findUnique({
      where: { username: ADMIN_USERNAME },
    });
    const user = await tx.user.upsert({
      where: { username: ADMIN_USERNAME },
      update: {
        companyId: company.id,
        deptId: dept.id,
        status: Status.NORMAL,
      },
      create: {
        username: ADMIN_USERNAME,
        passwordHash,
        nickname: '管理员',
        employeeName: '管理员',
        companyId: company.id,
        deptId: dept.id,
        status: Status.NORMAL,
      },
    });

    await tx.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });

    return !existing;
  });

  if (created) {
    console.log(`seeded admin account: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`);
  } else {
    console.log(
      `admin already exists, password left unchanged, company and role rebound`,
    );
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
