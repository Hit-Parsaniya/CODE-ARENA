export interface User {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin' | string;
  is_admin?: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface SignupPayload {
  username: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  username_or_email: string;
  password: string;
  intended_role?: 'admin' | 'user' | string;
}

export interface ApiError {
  detail: string | Array<{ loc: string[]; msg: string; type: string }>;
}
