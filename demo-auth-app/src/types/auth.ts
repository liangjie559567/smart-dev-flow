export interface User {
  id: string;
  email: string;
  username: string;
}

export interface AuthToken {
  token: string;
  expiresAt: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: AuthToken;
}

export type FieldErrors = Partial<Record<string, string>>;

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_TAKEN'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR';

export interface ApiError {
  code: AuthErrorCode;
  message: string;
  fields?: FieldErrors;
}

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login(req: LoginRequest): Promise<void>;
  register(req: RegisterRequest): Promise<void>;
  logout(): void;
}
