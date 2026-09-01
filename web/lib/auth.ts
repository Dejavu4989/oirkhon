// Accounts: email + password sign-in, Google sign-in, and sign-in sessions.
//
// Passwords use scrypt from node:crypto — no dependency, and the parameters are
// stored alongside each hash so they can be raised later without invalidating
// existing logins. Session cookies are random 256-bit tokens; only their
// SHA-256 is stored, so a database leak cannot be replayed as a login.
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { isDbConfigured, one, query } from "./db";

const scryptAsync = promisify(scrypt) as (
  password: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number },
) => Promise<Buffer>;

const SCRYPT = { N: 16384, r: 8, p: 1 };   // ~16 MB of work per hash
const KEYLEN = 64;
const SESSION_DAYS = 60;
export const MIN_PASSWORD = 8;

export interface Viewer {
  id: number;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  isSubscribed: boolean;
  subscriptionExpiresAt: string | null;
}

interface UserRow {
  id: string | number;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  password_hash: string | null;
  is_subscribed: boolean;
  subscription_expires_at: Date | null;
}

// ---- passwords ---------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize("NFKC"), salt, KEYLEN, SCRYPT);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p,
          salt.toString("hex"), key.toString("hex")].join("$");
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [scheme, n, r, p, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scryptAsync(
    password.normalize("NFKC"), Buffer.from(saltHex, "hex"), expected.length,
    { N: Number(n), r: Number(r), p: Number(p) },
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// ---- validation --------------------------------------------------------------

/** Deliberately permissive: the real check is whether mail is deliverable. */
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  return EMAIL_RE.test(email) && email.length <= 254 ? email : null;
}

export function passwordProblem(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length < MIN_PASSWORD) {
    return `Нууц үг дор хаяж ${MIN_PASSWORD} тэмдэгт байх ёстой.`;
  }
  if (raw.length > 200) return "Нууц үг хэт урт байна.";
  return null;
}

// ---- users -------------------------------------------------------------------

function toViewer(row: UserRow): Viewer {
  const expires = row.subscription_expires_at;
  return {
    id: Number(row.id),
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    // A lapsed term is not a subscription, whatever the flag says.
    isSubscribed: Boolean(row.is_subscribed) && (!expires || expires.getTime() > Date.now()),
    subscriptionExpiresAt: expires ? expires.toISOString() : null,
  };
}

const USER_COLUMNS =
  "id, email, display_name, avatar_url, password_hash, is_subscribed, subscription_expires_at";

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  return one<UserRow>(
    `SELECT ${USER_COLUMNS} FROM users WHERE lower(email) = lower($1)`, [email]);
}

export type SignupResult =
  | { ok: true; viewer: Viewer }
  | { ok: false; error: string; status: number };

export async function signup(rawEmail: unknown, rawPassword: unknown,
                             rawName: unknown): Promise<SignupResult> {
  const email = normalizeEmail(rawEmail);
  if (!email) return { ok: false, error: "И-мэйл хаяг буруу байна.", status: 400 };
  const pwProblem = passwordProblem(rawPassword);
  if (pwProblem) return { ok: false, error: pwProblem, status: 400 };

  if (await findUserByEmail(email)) {
    return { ok: false, error: "Энэ и-мэйлээр бүртгэл үүссэн байна.", status: 409 };
  }

  const displayName = typeof rawName === "string" && rawName.trim()
    ? rawName.trim().slice(0, 80)
    : email.split("@")[0];

  const row = await one<UserRow>(
    `INSERT INTO users (email, display_name, password_hash)
     VALUES ($1, $2, $3)
     RETURNING ${USER_COLUMNS}`,
    [email, displayName, await hashPassword(rawPassword as string)],
  );
  return { ok: true, viewer: toViewer(row!) };
}

export async function login(rawEmail: unknown, rawPassword: unknown): Promise<Viewer | null> {
  const email = normalizeEmail(rawEmail);
  if (!email || typeof rawPassword !== "string") return null;
  const row = await findUserByEmail(email);
  // Hash anyway when the account is missing, so a wrong address and a wrong
  // password take the same time and cannot be told apart.
  if (!row) {
    await hashPassword(rawPassword);
    return null;
  }
  return (await verifyPassword(rawPassword, row.password_hash)) ? toViewer(row) : null;
}

/** Sign-in with Google: match on the stable subject id, then on email. */
export async function upsertGoogleUser(profile: {
  sub: string; email: string | null; name: string | null; picture: string | null;
}): Promise<Viewer> {
  const bySub = await one<UserRow>(
    `SELECT ${USER_COLUMNS} FROM users WHERE google_sub = $1`, [profile.sub]);
  if (bySub) return toViewer(bySub);

  const email = normalizeEmail(profile.email);
  if (email) {
    const existing = await findUserByEmail(email);
    if (existing) {
      // Link Google to the account they already made with a password.
      const linked = await one<UserRow>(
        `UPDATE users SET google_sub = $1,
                          avatar_url = COALESCE(avatar_url, $2),
                          last_seen_at = now()
         WHERE id = $3 RETURNING ${USER_COLUMNS}`,
        [profile.sub, profile.picture, existing.id],
      );
      return toViewer(linked!);
    }
  }

  const created = await one<UserRow>(
    `INSERT INTO users (email, display_name, google_sub, avatar_url)
     VALUES ($1, $2, $3, $4) RETURNING ${USER_COLUMNS}`,
    [email, profile.name?.slice(0, 80) ?? email?.split("@")[0] ?? "Тоглогч",
     profile.sub, profile.picture],
  );
  return toViewer(created!);
}

// ---- sessions ----------------------------------------------------------------

export const SESSION_COOKIE = "oirkhon_session";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await query(
    `INSERT INTO auth_sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + ($3 || ' days')::interval)`,
    [userId, hashToken(token), String(SESSION_DAYS)],
  );
  return token;
}

/** Resolve the signed-in user, or null when signed out / not configured. */
export async function getViewer(token: string | undefined): Promise<Viewer | null> {
  if (!token || !isDbConfigured()) return null;
  try {
    const row = await one<UserRow>(
      `SELECT ${USER_COLUMNS.split(", ").map((c) => "u." + c).join(", ")}
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [hashToken(token)],
    );
    if (!row) return null;
    // Best-effort activity stamp; never fail a request over it.
    void query(`UPDATE auth_sessions SET last_seen_at = now() WHERE token_hash = $1`,
               [hashToken(token)]).catch(() => {});
    return toViewer(row);
  } catch {
    return null;   // database down: treat the visitor as signed out
  }
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token || !isDbConfigured()) return;
  await query(`DELETE FROM auth_sessions WHERE token_hash = $1`, [hashToken(token)]);
}

/** Admin/billing hook: flip a subscription on or off. */
export async function setSubscription(userId: number, on: boolean,
                                      expiresAt: Date | null = null): Promise<Viewer | null> {
  const row = await one<UserRow>(
    `UPDATE users SET is_subscribed = $2, subscription_expires_at = $3
     WHERE id = $1 RETURNING ${USER_COLUMNS}`,
    [userId, on, expiresAt],
  );
  return row ? toViewer(row) : null;
}
