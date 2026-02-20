import { getToken, setToken, removeToken, TOKEN_KEY } from '../utils/storage';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`FAIL: ${msg}`);
  console.log(`PASS: ${msg}`);
}

// 模拟 localStorage
const store: Record<string, string> = {};
global.localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
} as Storage;

assert(getToken() === null, 'getToken 初始返回 null');

setToken('abc123');
assert(getToken() === 'abc123', 'setToken 后 getToken 返回正确值');
assert(store[TOKEN_KEY] === 'abc123', 'token 存储在正确的 key');

removeToken();
assert(getToken() === null, 'removeToken 后 getToken 返回 null');
