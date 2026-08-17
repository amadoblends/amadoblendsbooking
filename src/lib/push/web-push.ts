/**
 * Web Push, implemented on WebCrypto rather than the `web-push` package.
 *
 * The library pulls in a Node-only crypto stack that doesn't run on Vercel's
 * edge runtime; this is roughly a hundred lines and works anywhere WebCrypto
 * does. Two specs are involved:
 *
 *   RFC 8292 — VAPID: a signed JWT proving who is sending, so the push
 *              service will accept the request.
 *   RFC 8291 — the payload is encrypted end-to-end with a key only the
 *              subscriber's browser holds. The push service relays ciphertext
 *              it cannot read.
 *
 * Keys come from VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY; generate them once
 * with the script in scripts/generate-vapid-keys.mjs.
 */

export interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Where tapping it should land. */
  url?: string;
  tag?: string;
  icon?: string;
}

export interface PushResult {
  ok: boolean;
  /** 404/410 mean the subscription is dead and should be deleted. */
  gone?: boolean;
  error?: string;
}

// ── base64url ──────────────────────────────────────────────────────────────

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...arrays: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(new ArrayBuffer(total));
  let at = 0;
  for (const a of arrays) {
    out.set(a, at);
    at += a.length;
  }
  return out;
}

// ── VAPID ──────────────────────────────────────────────────────────────────

/** The signed JWT that identifies this application to the push service. */
async function vapidHeader(endpoint: string, privateKeyB64: string, publicKeyB64: string) {
  const audience = new URL(endpoint).origin;
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    // Twelve hours: comfortably inside the 24h maximum the spec allows
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: process.env.VAPID_SUBJECT || "mailto:citas@amadoblends.com",
  };

  const signingInput = `${bytesToB64url(utf8(JSON.stringify(header)))}.${bytesToB64url(
    utf8(JSON.stringify(payload))
  )}`;

  // The raw 32-byte scalar has to be imported as a JWK for WebCrypto
  const d = b64urlToBytes(privateKeyB64);
  const pub = b64urlToBytes(publicKeyB64); // 65 bytes, uncompressed 0x04 || X || Y
  const key = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      d: bytesToB64url(d),
      x: bytesToB64url(pub.slice(1, 33)),
      y: bytesToB64url(pub.slice(33, 65)),
      ext: true,
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, utf8(signingInput))
  ) as Uint8Array<ArrayBuffer>;

  return {
    Authorization: `vapid t=${signingInput}.${bytesToB64url(signature)}, k=${publicKeyB64}`,
  };
}

// ── Payload encryption (aes128gcm) ─────────────────────────────────────────

/**
 * TextEncoder returns Uint8Array<ArrayBufferLike>, but WebCrypto's BufferSource
 * requires a plain ArrayBuffer. Copying through one keeps the types honest
 * without casting at every call site.
 */
function utf8(s: string): Uint8Array<ArrayBuffer> {
  const src = new TextEncoder().encode(s);
  const out = new Uint8Array(new ArrayBuffer(src.length));
  out.set(src);
  return out;
}

async function hkdf(
  salt: Uint8Array<ArrayBuffer>,
  ikm: Uint8Array<ArrayBuffer>,
  info: Uint8Array<ArrayBuffer>,
  length: number
): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    key,
    length * 8
  );
  return new Uint8Array(bits) as Uint8Array<ArrayBuffer>;
}

/**
 * Encrypts the payload so only the subscriber's browser can read it.
 * Produces the aes128gcm content-coding body from RFC 8188.
 */
async function encryptPayload(
  payload: string,
  p256dhB64: string,
  authB64: string
): Promise<Uint8Array<ArrayBuffer>> {
  const clientPublic = b64urlToBytes(p256dhB64);
  const authSecret = b64urlToBytes(authB64);

  // An ephemeral key pair per message — that's what makes each one distinct
  const ephemeral = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  const ephemeralPublic = new Uint8Array(
    await crypto.subtle.exportKey("raw", ephemeral.publicKey)
  ) as Uint8Array<ArrayBuffer>;

  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: clientKey }, ephemeral.privateKey, 256)
  ) as Uint8Array<ArrayBuffer>;

  // The key-info string binds the secret to both parties' public keys
  const keyInfo = concat(utf8("WebPush: info\0"), clientPublic, ephemeralPublic);
  const ikm = await hkdf(authSecret, shared, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
  const cek = await hkdf(salt, ikm, utf8("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, utf8("Content-Encoding: nonce\0"), 12);

  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  // 0x02 is the final-record delimiter required by the content coding
  const plaintext = concat(utf8(payload), new Uint8Array([0x02]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, plaintext)
  ) as Uint8Array<ArrayBuffer>;

  // Header: salt(16) | recordSize(4) | keyIdLen(1) | keyId(65)
  const recordSize = new Uint8Array(new ArrayBuffer(4));
  new DataView(recordSize.buffer).setUint32(0, 4096);

  return concat(
    salt,
    recordSize,
    new Uint8Array([ephemeralPublic.length]),
    ephemeralPublic,
    ciphertext
  );
}

// ── Sending ────────────────────────────────────────────────────────────────

export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

/**
 * Delivers one message to one subscription.
 *
 * Never throws: a dead subscription or an unreachable push service must not
 * fail the thing that triggered the notification.
 */
export async function sendPush(
  sub: PushSubscriptionRecord,
  message: PushMessage
): Promise<PushResult> {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return { ok: false, error: "push not configured" };

  try {
    const body = await encryptPayload(JSON.stringify(message), sub.p256dh, sub.auth);
    const auth = await vapidHeader(sub.endpoint, privateKey, publicKey);

    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        ...auth,
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: "86400",
        Urgency: "high",
      },
      body: body as unknown as BodyInit,
      signal: AbortSignal.timeout(8000),
    });

    if (res.status === 404 || res.status === 410) {
      // The browser dropped it; the caller should delete the row
      return { ok: false, gone: true, error: `subscription gone (${res.status})` };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `push ${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "push failed" };
  }
}
