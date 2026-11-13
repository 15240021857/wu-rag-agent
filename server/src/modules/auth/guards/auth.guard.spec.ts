import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { JwtService } from '@nestjs/jwt';
import { DataScope } from '@prisma/client';
import type { AuthService } from '../auth.service.js';
import type { AuthUser } from '../auth.types.js';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { AuthGuard } from './auth.guard.js';

const user: AuthUser = {
  id: 'u1',
  username: 'admin',
  companyId: 'c1',
  deptId: 'd1',
  permissions: ['system:user:query'],
  dataScope: DataScope.ALL,
};

describe('AuthGuard', () => {
  function setup() {
    const reflector = { getAllAndOverride: vi.fn() };
    const jwt = { verifyAsync: vi.fn() };
    const authService = { getAuthUser: vi.fn() };
    const guard = new AuthGuard(
      reflector as unknown as Reflector,
      jwt as unknown as JwtService,
      authService as unknown as AuthService,
    );
    return { reflector, jwt, authService, guard };
  }

  function context(authorization?: string) {
    const request: { headers: { authorization?: string }; user?: AuthUser } = {
      headers: authorization === undefined ? {} : { authorization },
    };
    return {
      request,
      context: {
        getHandler: () => 'handler',
        getClass: () => 'class',
        switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext,
    };
  }

  it('skips public routes', async () => {
    const { reflector, jwt, guard } = setup();
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      return key === IS_PUBLIC_KEY;
    });
    const { context: ctx } = context();

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects a missing or invalid token', async () => {
    const { reflector, jwt, guard } = setup();
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const missing = context();
    await expect(guard.canActivate(missing.context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    jwt.verifyAsync.mockRejectedValue(new Error('bad token'));
    const invalid = context('Bearer not-a-jwt');
    await expect(guard.canActivate(invalid.context)).rejects.toThrow(
      '登录已过期，请重新登录',
    );
  });

  it('attaches the user and allows a matching permission', async () => {
    const { reflector, jwt, authService, guard } = setup();
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === PERMISSIONS_KEY)
        return ['system:user:create', 'system:user:query'];
      return undefined;
    });
    jwt.verifyAsync.mockResolvedValue({ sub: 'u1', username: 'admin' });
    authService.getAuthUser.mockResolvedValue(user);
    const { request, context: ctx } = context('Bearer token');

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(authService.getAuthUser).toHaveBeenCalledWith('u1');
    expect(request.user).toBe(user);
  });

  it('rejects a signed-in user who lacks the permission', async () => {
    const { reflector, jwt, authService, guard } = setup();
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === PERMISSIONS_KEY) return ['system:user:delete'];
      return undefined;
    });
    jwt.verifyAsync.mockResolvedValue({ sub: 'u1', username: 'admin' });
    authService.getAuthUser.mockResolvedValue(user);
    const { context: ctx } = context('Bearer token');

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects a token whose user is no longer active', async () => {
    const { reflector, jwt, authService, guard } = setup();
    reflector.getAllAndOverride.mockReturnValue(undefined);
    jwt.verifyAsync.mockResolvedValue({ sub: 'u1', username: 'admin' });
    authService.getAuthUser.mockResolvedValue(null);
    const { context: ctx } = context('Bearer token');

    await expect(guard.canActivate(ctx)).rejects.toThrow(
      '登录已过期，请重新登录',
    );
  });
});
