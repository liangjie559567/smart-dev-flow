import type { LoginRequest, RegisterRequest, AuthResponse, ApiError } from '../types/auth';

const makeError = (code: ApiError['code'], message: string): ApiError =>
  ({ code, message });

const makeResponse = (id: string, email: string, username: string): AuthResponse => ({
  user: { id, email, username },
  token: { token: `token_${Date.now()}`, expiresAt: Date.now() + 3600_000 },
});

export const login = async (req: LoginRequest): Promise<AuthResponse> => {
  if (req.email === 'test@test.com' && req.password === '123456')
    return makeResponse('1', req.email, 'testuser');
  throw makeError('INVALID_CREDENTIALS', '邮箱或密码错误');
};

export const register = async (req: RegisterRequest): Promise<AuthResponse> => {
  if (req.email === 'taken@test.com')
    throw makeError('EMAIL_TAKEN', '该邮箱已被注册');
  return makeResponse(String(Date.now()), req.email, req.username);
};
