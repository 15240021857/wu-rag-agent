import {
  BadRequestException,
  PayloadTooLargeException,
  ValidationPipe,
  type ArgumentsHost,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import { PageQueryDto } from '../dto/page.dto.js';

describe('AllExceptionsFilter', () => {
  it('turns validator errors into the response envelope', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const caught = await pipe
      .transform({ pageSize: '501' }, { type: 'query', metatype: PageQueryDto })
      .then(() => undefined)
      .catch((error: unknown) => error);

    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as unknown as ArgumentsHost;

    new AllExceptionsFilter().catch(caught, host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      code: 400,
      message: '每页最多 500 条',
      data: null,
    });
    expect(caught).toBeInstanceOf(BadRequestException);
  });

  it('turns an oversized upload into a Chinese message', () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as unknown as ArgumentsHost;

    new AllExceptionsFilter().catch(
      new PayloadTooLargeException('File too large'),
      host,
    );

    expect(status).toHaveBeenCalledWith(413);
    expect(json).toHaveBeenCalledWith({
      code: 413,
      message: '文件过大',
      data: null,
    });
  });
});
