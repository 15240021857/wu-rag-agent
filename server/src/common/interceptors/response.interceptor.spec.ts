import { lastValueFrom, of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor.js';

describe('ResponseInterceptor', () => {
  const interceptor = new ResponseInterceptor();

  function run(data: unknown) {
    return lastValueFrom(
      interceptor.intercept({} as never, { handle: () => of(data) }),
    );
  }

  it('keeps the usual ok envelope', async () => {
    await expect(run({ id: '1' })).resolves.toEqual({
      code: 0,
      message: 'ok',
      data: { id: '1' },
    });
  });

  it('uses a stated message', async () => {
    await expect(
      run({ message: '上传完成，等待向量化', data: { id: '1' } }),
    ).resolves.toEqual({
      code: 0,
      message: '上传完成，等待向量化',
      data: { id: '1' },
    });
  });
});
