import { NextRequest, NextResponse } from 'next/server';
import { signToken, TOKEN_NAME, TOKEN_MAX_AGE } from '@/lib/auth';
import { query } from '@/lib/db';

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

    // Log for debugging
    console.log('🔐 LINE Login attempt:', { lineUserId, displayName });

    // Check staff table
    const result = await query(
      `SELECT id, name, store, role FROM staff WHERE line_user_id = $1 AND is_active = true`,
      [lineUserId]
    );

    if (result.rows.length === 0) {
      // Not registered - show LINE ID so admin can add them
      return NextResponse.redirect(`${appUrl}/login?error=not_authorized&hint=${lineUserId}`);
    }

    const staff = result.rows[0];

    // Determine store access based on role
    const storeAccess = staff.role === 'owner' || staff.role === 'manager'
      ? ['all']
      : [staff.store];

    // Issue JWT with staff info
    const jwt = signToken({
      sub: lineUserId,
      name: staff.name,
      role: staff.role,
      store_access: storeAccess,
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
  } catch (error) {
    console.error('LINE callback error:', error);
    return NextResponse.redirect(`${appUrl}/login?error=unknown`);
  }
}
