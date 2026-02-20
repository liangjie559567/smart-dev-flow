// 注意：生产环境应使用 httpOnly Cookie，此处使用内存存储避免 XSS 风险
// Mock 演示项目：token 不持久化（页面刷新后需重新登录）
let _token: string | null = null;

export const TOKEN_KEY = 'auth_token';
export const getToken = (): string | null => _token;
export const setToken = (token: string): void => { _token = token; };
export const removeToken = (): void => { _token = null; };
