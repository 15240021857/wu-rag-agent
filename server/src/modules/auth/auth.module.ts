import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import type { AppConfig } from '../../config/configuration.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './guards/auth.guard.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const secret = config.get('jwtSecret', { infer: true });
        if (!secret) throw new Error('缺少环境变量 JWT_SECRET');
        return {
          secret,
          signOptions: {
            expiresIn: parseExpiresIn(
              config.get('jwtExpiresIn', { infer: true }),
            ),
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [AuthService],
})
export class AuthModule {}

function parseExpiresIn(raw: string | undefined) {
  const value = raw?.trim() || '7d';
  if (/^\d+$/.test(value)) return Number(value);
  return value as `${number}d`;
}
