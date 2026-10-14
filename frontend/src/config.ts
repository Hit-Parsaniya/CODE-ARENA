export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string) ||
  (import.meta.env.API_BASE_URL as string) ||
  'http://localhost:8000';
