import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T | null;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data): ApiResponse<T> => {
        const stated = statedResult(data);
        if (stated) {
          return {
            code: 0,
            message: stated.message,
            data: (stated.data ?? null) as T | null,
          };
        }
        return {
          code: 0,
          message: 'ok',
          data: data ?? null,
        };
      }),
    );
  }
}

function statedResult(
  data: unknown,
): { message: string; data: unknown } | undefined {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return undefined;
  }
  const record = data as Record<string, unknown>;
  const keys = Object.keys(record);
  if (
    keys.length !== 2 ||
    typeof record.message !== 'string' ||
    !Object.hasOwn(record, 'data')
  ) {
    return undefined;
  }
  return { message: record.message, data: record.data };
}
