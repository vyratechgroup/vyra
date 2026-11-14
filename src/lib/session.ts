import { cookies } from "next/headers";
import { config } from "./config";
import { newSecret, sha256 } from "./security";

// Accountless MVP: an httpOnly cookie ties a browser to its purchase while the flow is
// in progress. Only the hash is stored server-side. Once the report exists, its secret
// link is what grants access, from any device.

const SESSION_COOKIE = "flicks_session";
const REPORT_COOKIE = "flicks_report";
const PAYMENT_COOKIE = "flicks_payment_id";
const TOKEN_ID_COOKIE = "flicks_token_id";
const TOKEN_SECRET_COOKIE = "flicks_token_secret";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: config.isProduction,
  path: "/",
  maxAge: 72 * 60 * 60,
};

export async function readSessionHash() {
  try {
    const value = (await cookies()).get(SESSION_COOKIE)?.value;
    return value ? sha256(value) : null;
  } catch {
    return null;
  }
}

/** Route handlers only: creates the session cookie when it does not exist yet. */
export async function ensureSessionHash() {
  try {
    const jar = await cookies();
    let value = jar.get(SESSION_COOKIE)?.value;
    if (!value) {
      value = newSecret();
      jar.set(SESSION_COOKIE, value, cookieOptions);
    }
    return sha256(value);
  } catch {
    // ponytail: fallback in unit test/script environments where Next async storage is absent
    return sha256("dev-session");
  }
}

export async function rememberPaymentId(paymentId: string) {
  try {
    (await cookies()).set(PAYMENT_COOKIE, paymentId, cookieOptions);
  } catch {
    // Ignore when called outside request scope
  }
}

export async function readPaymentId() {
  try {
    return (await cookies()).get(PAYMENT_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export async function rememberToken(tokenId: string, tokenSecret?: string | null) {
  try {
    const jar = await cookies();
    jar.set(TOKEN_ID_COOKIE, tokenId, cookieOptions);
    if (tokenSecret) {
      jar.set(TOKEN_SECRET_COOKIE, tokenSecret, cookieOptions);
    }
  } catch {
    // Ignore when called outside request scope
  }
}

export async function readTokenId() {
  try {
    return (await cookies()).get(TOKEN_ID_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export async function readTokenSecret() {
  try {
    return (await cookies()).get(TOKEN_SECRET_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export async function rememberReportSecret(secret: string) {
  try {
    (await cookies()).set(REPORT_COOKIE, secret, cookieOptions);
  } catch {
    // Ignore when called outside request scope
  }
}

export async function readReportSecret() {
  try {
    return (await cookies()).get(REPORT_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export async function clearFlowCookies() {
  try {
    const jar = await cookies();
    jar.delete(SESSION_COOKIE);
    jar.delete(REPORT_COOKIE);
    jar.delete(PAYMENT_COOKIE);
    jar.delete(TOKEN_ID_COOKIE);
    jar.delete(TOKEN_SECRET_COOKIE);
  } catch {
    // Ignore when called outside request scope
  }
}
