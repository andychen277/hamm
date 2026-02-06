import { NextRequest, NextResponse } from 'next/server';
import { signToken, TOKEN_NAME, TOKEN_MAX_AGE } from '@/lib/auth';
import { checkPinRateLimit, recordPinFailure, resetPinAttempts } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

  // Rate limit check
  const rateLimit = checkPinRateLimit(ip);
  if (!rateLimit.allowed) {
    const minutes = Math.ceil((rateLimit.lockedUntilMs! - Date.now()) / 60000);
    return NextResponse.json(
      { success: false, error: `嘗試次數過多，請 ${minutes} 分鐘後再試` },
      { status: 429 }
    );
  }

  const { pin } = await req.json();
  const correctPin = process.env.ADMIN_PIN;
  if (!correctPin) {
    return NextResponse.json(
      { success: false, error: 'PIN 登入未設定' },
      { status: 500 }
    );
  }

  if (pin !== correctPin) {
    recordPinFailure(ip);
    const remaining = rateLimit.remainingAttempts - 1;
    return NextResponse.json(
      { success: false, error: `PIN 碼錯誤，剩餘 ${remaining} 次嘗試` },
      { status: 401 }
    );
  }

  // PIN correct
  resetPinAttempts(ip);

  const token = signToken({
    sub: 'pin_user',
    name: 'Andy',
    role: 'owner',
    store_access: ['all'],
  });

  const response = NextResponse.json({ success: true });
  response.cookies.set(TOKEN_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: TOKEN_MAX_AGE,
    path: '/',
  });

  return response;
}
