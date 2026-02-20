import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateEmail, validatePassword, validateUsername } from '../utils/validators';
import type { ApiError } from '../types/auth';

const RegisterForm: React.FC = () => {
  const { register, isLoading } = useAuth();
  const navigate = useNavigate();
  const [fields, setFields] = useState({ username: '', email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const u = validateUsername(fields.username);
    const em = validateEmail(fields.email);
    const p = validatePassword(fields.password);
    if (u) errs.username = u;
    if (em) errs.email = em;
    if (p) errs.password = p;
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    try {
      await register(fields);
      navigate('/dashboard');
    } catch (err) {
      const apiErr = err as ApiError;
      setErrors({ ...(apiErr.fields ?? {}), form: apiErr.message });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {(['username', 'email', 'password'] as const).map(k => (
        <div key={k}>
          <input value={fields[k]} onChange={set(k)} placeholder={k} type={k === 'password' ? 'password' : 'text'} />
          {errors[k] && <span>{errors[k]}</span>}
        </div>
      ))}
      {errors.form && <div>{errors.form}</div>}
      <button type="submit" disabled={isLoading}>{isLoading ? '注册中...' : '注册'}</button>
    </form>
  );
};

export default RegisterForm;
