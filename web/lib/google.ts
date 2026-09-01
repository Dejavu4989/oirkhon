// Google sign-in (OAuth 2.0 authorization-code flow).
//
// Configure with:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
//   APP_ORIGIN (optional, e.g. https://lessgames.mn — defaults to the request origin)
//
// In the Google Cloud console the authorised redirect URI must be
//   <origin>/api/auth/google/callback
//
// The profile is read from the userinfo endpoint using the access token rather
// than by decoding the id_token, so there is no JWT signature check to get
// wrong — the data comes straight from Google over TLS.

export const STATE_COOKIE = "oirkhon_oauth_state";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function redirectUri(origin: string): string {
  return `${process.env.APP_ORIGIN ?? origin}/api/auth/google/callback`;
}

export function authUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `${AUTH_ENDPOINT}?${params}`;
}

export interface GoogleProfile {
  sub: string;
  email: string | null;
  name: string | null;
  picture: string | null;
}

export async function exchangeCode(code: string, origin: string): Promise<GoogleProfile> {
  const tokenRes = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`google token exchange failed: ${tokenRes.status}`);
  }
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) throw new Error("google returned no access token");

  const infoRes = await fetch(USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${access_token}` },
  });
  if (!infoRes.ok) throw new Error(`google userinfo failed: ${infoRes.status}`);

  const info = (await infoRes.json()) as {
    sub?: string; email?: string; email_verified?: boolean;
    name?: string; picture?: string;
  };
  if (!info.sub) throw new Error("google profile had no subject id");

  return {
    sub: info.sub,
    // An unverified address must not be able to claim someone else's account.
    email: info.email && info.email_verified !== false ? info.email : null,
    name: info.name ?? null,
    picture: info.picture ?? null,
  };
}
