// Auth tests against a real Postgres. Skipped unless DATABASE_URL is set, so
// the normal suite still runs on a machine without a database.
//
//   DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/oirkhon_test npx vitest run
//
// Point it at a scratch database: it deletes every row in users/auth_sessions.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createSession, destroySession, getViewer, hashPassword, login,
  normalizeEmail, passwordProblem, setSubscription, signup, upsertGoogleUser,
  verifyPassword,
} from "../auth";
import { closePool, query } from "../db";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe("password hashing", () => {
  it("round-trips and rejects the wrong password", async () => {
    const stored = await hashPassword("нууц үг 123");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("нууц үг 123", stored)).toBe(true);
    expect(await verifyPassword("wrong", stored)).toBe(false);
  });

  it("salts, so the same password hashes differently each time", async () => {
    expect(await hashPassword("samepass1")).not.toBe(await hashPassword("samepass1"));
  });

  it("never accepts a missing or malformed hash", async () => {
    expect(await verifyPassword("x", null)).toBe(false);
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$1$2$3$4$5")).toBe(false);
  });
});

describe("validation", () => {
  it("normalises and rejects bad emails", () => {
    expect(normalizeEmail("  Bat@Example.MN ")).toBe("bat@example.mn");
    expect(normalizeEmail("no-at-sign")).toBeNull();
    expect(normalizeEmail("a@b")).toBeNull();          // needs a dot in the host
    expect(normalizeEmail(42)).toBeNull();
  });

  it("requires a password of a usable length", () => {
    expect(passwordProblem("short")).toBeTruthy();
    expect(passwordProblem("longenough1")).toBeNull();
    expect(passwordProblem("x".repeat(500))).toBeTruthy();
  });
});

describe.skipIf(!HAS_DB)("accounts (Postgres)", () => {
  beforeEach(async () => {
    await query("DELETE FROM auth_sessions");
    await query("DELETE FROM users");
  });

  afterAll(async () => { await closePool(); });

  it("signs up and signs in", async () => {
    const created = await signup("Bat@Example.MN", "supersecret1", "Бат");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.viewer.email).toBe("bat@example.mn");   // stored lower-case
    expect(created.viewer.displayName).toBe("Бат");
    expect(created.viewer.isSubscribed).toBe(false);

    const ok = await login("bat@example.mn", "supersecret1");
    expect(ok?.id).toBe(created.viewer.id);
    // Case-insensitive on the address, exact on the password.
    expect(await login("BAT@EXAMPLE.MN", "supersecret1")).not.toBeNull();
    expect(await login("bat@example.mn", "wrongpass1")).toBeNull();
    expect(await login("nobody@example.mn", "supersecret1")).toBeNull();
  });

  it("refuses a duplicate address regardless of case", async () => {
    expect((await signup("dup@example.mn", "supersecret1", null)).ok).toBe(true);
    const again = await signup("DUP@example.mn", "othersecret1", null);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.status).toBe(409);
  });

  it("rejects a bad address or a weak password", async () => {
    expect((await signup("nope", "supersecret1", null)).ok).toBe(false);
    expect((await signup("ok@example.mn", "short", null)).ok).toBe(false);
    expect(await query("SELECT 1 FROM users")).toHaveLength(0);
  });

  it("issues a session that resolves back to the user, then revokes it", async () => {
    const created = await signup("sess@example.mn", "supersecret1", null);
    if (!created.ok) throw new Error("signup failed");

    const token = await createSession(created.viewer.id);
    const viewer = await getViewer(token);
    expect(viewer?.email).toBe("sess@example.mn");

    // The raw token is never stored — only its digest.
    const rows = await query<{ token_hash: string }>("SELECT token_hash FROM auth_sessions");
    expect(rows[0].token_hash).not.toBe(token);
    expect(rows[0].token_hash).toHaveLength(64);

    await destroySession(token);
    expect(await getViewer(token)).toBeNull();
    expect(await getViewer("garbage")).toBeNull();
    expect(await getViewer(undefined)).toBeNull();
  });

  it("ignores an expired session", async () => {
    const created = await signup("exp@example.mn", "supersecret1", null);
    if (!created.ok) throw new Error("signup failed");
    const token = await createSession(created.viewer.id);
    await query("UPDATE auth_sessions SET expires_at = now() - interval '1 day'");
    expect(await getViewer(token)).toBeNull();
  });

  it("tracks subscription state, and treats a lapsed term as unsubscribed", async () => {
    const created = await signup("sub@example.mn", "supersecret1", null);
    if (!created.ok) throw new Error("signup failed");
    const id = created.viewer.id;

    const on = await setSubscription(id, true, new Date(Date.now() + 86_400_000));
    expect(on?.isSubscribed).toBe(true);

    const lapsed = await setSubscription(id, true, new Date(Date.now() - 86_400_000));
    expect(lapsed?.isSubscribed).toBe(false);

    const lifetime = await setSubscription(id, true, null);
    expect(lifetime?.isSubscribed).toBe(true);

    const off = await setSubscription(id, false, null);
    expect(off?.isSubscribed).toBe(false);
  });

  it("google sign-in creates once, then matches on the subject id", async () => {
    const first = await upsertGoogleUser({
      sub: "google-123", email: "g@example.mn", name: "G", picture: "https://x/p.png",
    });
    const again = await upsertGoogleUser({
      sub: "google-123", email: "changed@example.mn", name: "G2", picture: null,
    });
    expect(again.id).toBe(first.id);
    expect(await query("SELECT 1 FROM users")).toHaveLength(1);
  });

  it("google sign-in links onto an existing password account", async () => {
    const created = await signup("link@example.mn", "supersecret1", null);
    if (!created.ok) throw new Error("signup failed");

    const linked = await upsertGoogleUser({
      sub: "google-456", email: "LINK@example.mn", name: "L", picture: null,
    });
    expect(linked.id).toBe(created.viewer.id);
    expect(await query("SELECT 1 FROM users")).toHaveLength(1);
    // The password still works after linking.
    expect(await login("link@example.mn", "supersecret1")).not.toBeNull();
  });

  it("keeps two different google accounts apart", async () => {
    await upsertGoogleUser({ sub: "a", email: "a@example.mn", name: null, picture: null });
    await upsertGoogleUser({ sub: "b", email: "b@example.mn", name: null, picture: null });
    expect(await query("SELECT 1 FROM users")).toHaveLength(2);
  });
});
