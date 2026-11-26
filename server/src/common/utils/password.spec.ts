import { hashPassword, verifyPassword } from './password.js';

describe('password', () => {
  it('accepts the original password and rejects a different one', async () => {
    const hash = await hashPassword('123456');
    await expect(verifyPassword('123456', hash)).resolves.toBe(true);
    await expect(verifyPassword('admin124', hash)).resolves.toBe(false);
  });
});
