import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth.service.js';
import type { AccessTokenPayload, AuthUser } from '../auth.types.js';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator.js';
import { isPublic } from '../decorators/public.decorator.js';

interface HttpRequest {
  headers: { authorization?: string };
  user?: AuthUser;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (isPublic(this.reflector, context)) return true;

    const request = context.switchToHttp().getRequest<HttpRequest>();
    const token = bearerToken(request.headers?.authorization);
    if (!token) throw new UnauthorizedException('未登录');

    const user = await this.authService.getAuthUser(
      await this.readUserId(token),
    );
    if (!user) throw new UnauthorizedException('登录已过期，请重新登录');
    request.user = user;

    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;
    if (required.some((permission) => user.permissions.includes(permission))) {
      return true;
    }
    throw new ForbiddenException('没有操作权限');
  }

  private async readUserId(token: string) {
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      if (typeof payload?.sub !== 'string' || !payload.sub) {
        throw new UnauthorizedException('登录已过期，请重新登录');
      }
      return payload.sub;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('登录已过期，请重新登录');
    }
  }
}

function bearerToken(header: string | undefined) {
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}
