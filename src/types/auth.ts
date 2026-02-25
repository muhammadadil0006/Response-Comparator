import { TokenType } from '@/types/enums';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
}

export interface AuthState {
  user: User | null;
  access: string | null;
  refresh: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

export interface AuthResponse {
  user: User;
  access: string;
  refresh: string;
}

export interface JWTPayload {
  user_id: string;
  email: string;
  type: TokenType;
}

/** Typed API error shape returned by RTK Query mutations */
export interface ApiError {
  status?: number;
  data?: {
    error?: string;
    details?: Array<{ message: string }>;
  };
}
