import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateEmail, validatePassword } from '../utils/validators';
import type { ApiError } from '../types/auth';

const LoginForm: React.FC = () => {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailErr = validateEmail(email);
    const passErr = validatePassword(password);
    if (emailErr || passErr) { setErrors({ email: emailErr ?? undefined, password: passErr ?? undefined }); return; }
    setErrors({});
    try {
      await login({ email, password });
      navigate('/dashboard');
    } catch (err) {
      setErrors({ form: (err as ApiError).message });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="邮箱" type="email" />
        {errors.email && <span>{errors.email}</span>}
      </div>
      <div>
        <input value={password} onChange={e => setPassword(e.target.value)} placeholder="密码" type="password" />
        {errors.password && <span>{errors.password}</span>}
      </div>
      {errors.form && <div>{errors.form}</div>}
      <button type="submit" disabled={isLoading}>{isLoading ? '登录中...' : '登录'}</button>
    </form>
  );
};

export default LoginForm;
