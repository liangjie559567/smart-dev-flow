export const validateEmail = (email: string): string | null =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? null : '请输入有效的邮箱地址';

export const validatePassword = (password: string): string | null =>
  password.length >= 6 ? null : '密码至少需要6位';

export const validateUsername = (username: string): string | null =>
  username.length >= 2 ? null : '用户名至少需要2位';
