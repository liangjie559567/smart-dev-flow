import React from 'react';
import { Link } from 'react-router-dom';
import LoginForm from '../components/LoginForm';

const LoginPage: React.FC = () => (
  <div>
    <h1>登录</h1>
    <LoginForm />
    <p>没有账号？<Link to="/register">注册</Link></p>
  </div>
);

export default LoginPage;
