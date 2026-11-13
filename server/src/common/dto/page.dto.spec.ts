import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { PageQueryDto } from './page.dto.js';

describe('PageQueryDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
  });

  function parse(value: Record<string, unknown>) {
    return pipe.transform(value, { type: 'query', metatype: PageQueryDto });
  }

  it('keeps defaults when the query is empty', async () => {
    await expect(parse({})).resolves.toMatchObject({
      pageNum: 1,
      pageSize: 10,
    });
  });

  it('coerces numeric query strings', async () => {
    await expect(
      parse({ pageNum: '2', pageSize: '500' }),
    ).resolves.toMatchObject({
      pageNum: 2,
      pageSize: 500,
    });
  });

  it('rejects a page size above 500', async () => {
    await expect(parse({ pageSize: '501' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
