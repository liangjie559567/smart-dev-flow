import React from 'react';
import { Link } from 'react-router-dom';
import RegisterForm from '../components/RegisterForm';

const RegisterPage: React.FC = () => (
  <div>
    <h1>注册</h1>
    <RegisterForm />
    <p>已有账号？<Link to="/login">登录</Link></p>
  </div>
);

export default RegisterPage;
