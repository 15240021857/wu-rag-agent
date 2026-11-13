import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (!(exception instanceof HttpException)) {
      this.logger.error(exception);
    }

    response.status(status).json({
      code: status,
      message: this.resolveMessage(exception),
      data: null,
    });
  }

  private resolveMessage(exception: unknown) {
    if (exception instanceof PayloadTooLargeException) return '文件过大';
    if (!(exception instanceof HttpException)) return '服务器异常';

    const body = exception.getResponse();
    if (typeof body === 'string') return body;
    if (typeof body !== 'object' || body === null || !('message' in body)) {
      return exception.message;
    }

    const messages = collectMessages(body.message);
    return messages.length ? messages.join('; ') : exception.message;
  }
}

function collectMessages(raw: unknown): string[] {
  if (typeof raw === 'string') return [raw];
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => collectMessages(messageOf(item)));
}

function messageOf(item: unknown): unknown {
  if (typeof item !== 'object' || item === null) return item;
  const messages: string[] = [];
  if (
    'constraints' in item &&
    item.constraints &&
    typeof item.constraints === 'object'
  ) {
    for (const value of Object.values(item.constraints)) {
      if (typeof value === 'string') messages.push(value);
    }
  }
  if ('children' in item && Array.isArray(item.children)) {
    messages.push(...collectMessages(item.children));
  }
  return messages;
}
