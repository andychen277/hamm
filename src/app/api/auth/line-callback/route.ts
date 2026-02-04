import { NextRequest, NextResponse } from 'next/server';
import { signToken, isAdmin, TOKEN_NAME, TOKEN_MAX_AGE } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!code) {
    return NextResponse.redirect(`${appUrl}/login?error=no_code`);
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.LINE_LOGIN_CALLBACK_URL || '',
        client_id: process.env.LINE_LOGIN_CHANNEL_ID || '',
        client_secret: process.env.LINE_LOGIN_CHANNEL_SECRET || '',
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(`${appUrl}/login?error=token_failed`);
    }

    const tokenData = await tokenRes.json();

    // Get user profile
    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileRes.ok) {
      return NextResponse.redirect(`${appUrl}/login?error=profile_failed`);
    }

    const profile = await profileRes.json();
    const lineUserId = profile.userId;
    const displayName = profile.displayName;

    // Check whitelist
    if (!isAdmin(lineUserId)) {
      return NextResponse.redirect(`${appUrl}/login?error=not_authorized`);
    }

    // Issue JWT
    const jwt = signToken({
      sub: lineUserId,
      name: displayName,
      role: 'owner',
      store_access: ['all'],
    });

    const response = NextResponse.redirect(`${appUrl}/dashboard`);
    response.cookies.set(TOKEN_NAME, jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: TOKEN_MAX_AGE,
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.redirect(`${appUrl}/login?error=unknown`);
  }
}
