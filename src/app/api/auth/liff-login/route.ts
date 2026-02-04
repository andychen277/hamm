import { NextRequest, NextResponse } from 'next/server';
import { signToken, isAdmin, TOKEN_NAME, TOKEN_MAX_AGE } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { accessToken } = await req.json();

  if (!accessToken) {
    return NextResponse.json(
      { success: false, error: 'Missing access token' },
      { status: 400 }
    );
  }

  try {
    // Verify LIFF access token and get profile
    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!profileRes.ok) {
      return NextResponse.json(
        { success: false, error: 'Invalid access token' },
        { status: 401 }
      );
    }

    const profile = await profileRes.json();
    const lineUserId = profile.userId;
    const displayName = profile.displayName;

    // Check whitelist
    if (!isAdmin(lineUserId)) {
      return NextResponse.json(
        { success: false, error: '無權限存取此系統' },
        { status: 403 }
      );
    }

    // Issue JWT
    const jwt = signToken({
      sub: lineUserId,
      name: displayName,
      role: 'owner',
      store_access: ['all'],
    });

    const response = NextResponse.json({ success: true, name: displayName });
    response.cookies.set(TOKEN_NAME, jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: TOKEN_MAX_AGE,
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
