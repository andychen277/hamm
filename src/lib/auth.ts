import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret';
const TOKEN_NAME = 'hamm_token';
const TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

export interface JwtPayload {
  sub: string;        // staff_id or 'pin_user'
  name: string;
  role: 'admin' | 'owner' | 'manager' | 'staff';
  store_access: string[];
  staff_id?: number;
  store?: string | null;
  iat?: number;
  exp?: number;
}

export function signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_MAX_AGE });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<JwtPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function isAdmin(lineUserId: string): boolean {
  const adminIds = (process.env.ADMIN_LINE_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  return adminIds.includes(lineUserId);
}

export { TOKEN_NAME, TOKEN_MAX_AGE };
