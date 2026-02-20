import { login, register } from '../api/auth';
import type { ApiError } from '../types/auth';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`FAIL: ${msg}`);
  console.log(`PASS: ${msg}`);
}

async function run() {
  // login 成功
  const res = await login({ email: 'test@test.com', password: '123456' });
  assert(res.user.email === 'test@test.com', 'login success returns correct user');
  assert(typeof res.token.token === 'string', 'login success returns token');

  // login 失败
  try {
    await login({ email: 'wrong@test.com', password: 'wrong' });
    assert(false, 'login should throw on invalid credentials');
  } catch (e) {
    assert((e as ApiError).code === 'INVALID_CREDENTIALS', 'login throws INVALID_CREDENTIALS');
  }

  // register 成功
  const res2 = await register({ username: 'newuser', email: 'new@test.com', password: '123456' });
  assert(res2.user.email === 'new@test.com', 'register success returns correct user');

  // register email 已占用
  try {
    await register({ username: 'x', email: 'taken@test.com', password: '123456' });
    assert(false, 'register should throw on taken email');
  } catch (e) {
    assert((e as ApiError).code === 'EMAIL_TAKEN', 'register throws EMAIL_TAKEN');
  }
}

run().catch(e => { console.error(e.message); process.exit(1); });
