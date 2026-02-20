import React, { createContext, useContext, useReducer } from 'react';
import type { User, AuthContextValue, LoginRequest, RegisterRequest } from '../types/auth';
import * as api from '../api/auth';
import { setToken, removeToken } from '../utils/storage';

type State = { user: User | null; isLoading: boolean };
type Action =
  | { type: 'SET_USER'; user: User }
  | { type: 'LOGOUT' }
  | { type: 'SET_LOADING'; value: boolean };

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_USER': return { user: action.user, isLoading: false };
    case 'LOGOUT': return { user: null, isLoading: false };
    case 'SET_LOADING': return { ...state, isLoading: action.value };
    default: return state;
  }
};

const AuthContext = createContext<AuthContextValue>(null!);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 内存存储：初始状态无需恢复，isLoading 直接为 false
  const [state, dispatch] = useReducer(reducer, { user: null, isLoading: false });

  const login = async (req: LoginRequest) => {
    dispatch({ type: 'SET_LOADING', value: true });
    try {
      const res = await api.login(req);
      setToken(res.token.token);
      dispatch({ type: 'SET_USER', user: res.user });
    } finally {
      dispatch({ type: 'SET_LOADING', value: false });
    }
  };

  const register = async (req: RegisterRequest) => {
    dispatch({ type: 'SET_LOADING', value: true });
    try {
      const res = await api.register(req);
      setToken(res.token.token);
      dispatch({ type: 'SET_USER', user: res.user });
    } finally {
      dispatch({ type: 'SET_LOADING', value: false });
    }
  };

  const logout = () => {
    removeToken();
    dispatch({ type: 'LOGOUT' });
  };

  return (
    <AuthContext.Provider value={{ ...state, isAuthenticated: state.user !== null, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
