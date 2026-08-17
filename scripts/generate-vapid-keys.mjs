/**
 * Generates the VAPID key pair for Web Push. Run once:
 *
 *   node scripts/generate-vapid-keys.mjs
 *
 * Put the output in both Vercel projects. The public key is safe to expose
 * (the browser needs it to subscribe); the private key must stay server-side,
 * which is why it has no NEXT_PUBLIC_ prefix.
 */

import { webcrypto as crypto } from "node:crypto";

function b64url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
  "sign",
  "verify",
]);

// The public key goes over the wire uncompressed: 0x04 || X || Y
const publicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
// The private key is the raw 32-byte scalar `d` out of the JWK
const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);

console.log("\nAñade estas variables a Vercel (en los DOS proyectos):\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${b64url(publicRaw)}`);
console.log(`VAPID_PUBLIC_KEY=${b64url(publicRaw)}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
console.log(`VAPID_SUBJECT=mailto:tucorreo@ejemplo.com\n`);
console.log("La privada no lleva NEXT_PUBLIC_: nunca debe llegar al navegador.\n");
