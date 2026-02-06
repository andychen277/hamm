import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export async function GET() {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  const callbackUrl = process.env.LINE_LOGIN_CALLBACK_URL;

  if (!channelId || !callbackUrl) {
    return NextResponse.json(
      { success: false, error: 'LINE Login not configured' },
      { status: 500 }
    );
  }

  const state = randomUUID();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: channelId,
    redirect_uri: callbackUrl,
    state,
    scope: 'profile openid',
  });

  const lineLoginUrl = `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;

  return NextResponse.redirect(lineLoginUrl);
}
