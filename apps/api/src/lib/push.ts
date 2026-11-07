import { createPrivateKey, createPublicKey } from "node:crypto";
import { sendNotification } from "web-push";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { prisma } from "./prisma.js";

export interface PushPayload {
  title: string;
  body: string;
  link?: string;
  tag?: string;
}

/** Pushes recorded in tests (PUSH_TRANSPORT=memory). */
export const pushOutbox: { endpoint: string; payload: PushPayload }[] = [];

const b64url = (b: Buffer) => b.toString("base64url");

/** VAPID keys in the raw base64url form browsers expect, derived from one PEM private key. */
export function vapidKeys(pem = env.VAPID_PRIVATE_KEY_PEM): { publicKey: string; privateKey: string } | null {
  if (!pem) return null;
  try {
    const key = createPrivateKey(pem.replace(/\\n/g, "\n"));
    const jwk = key.export({ format: "jwk" });
    if (jwk.crv !== "P-256" || !jwk.d) throw new Error("VAPID key must be an EC P-256 private key");
    const pub = createPublicKey(key).export({ format: "jwk" });
    const raw = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x!, "base64url"), Buffer.from(pub.y!, "base64url")]);
    return { publicKey: b64url(raw), privateKey: jwk.d };
  } catch (err) {
    logger.error({ err }, "invalid VAPID_PRIVATE_KEY_PEM; push is off");
    return null;
  }
}

let keys: ReturnType<typeof vapidKeys> | undefined;
export const pushKeys = () => (keys === undefined ? (keys = vapidKeys()) : keys);
export const pushEnabled = () => env.PUSH_TRANSPORT === "memory" || !!pushKeys();

/** Sends to every device the user enabled. Dead subscriptions (404/410) are removed. Never throws. */
export async function sendPush(userId: string, payload: PushPayload) {
  if (!pushEnabled()) return 0;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  for (const s of subs) {
    if (env.PUSH_TRANSPORT === "memory") {
      pushOutbox.push({ endpoint: s.endpoint, payload });
      sent++;
      continue;
    }
    const k = pushKeys()!;
    try {
      await sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { vapidDetails: { subject: env.VAPID_SUBJECT, publicKey: k.publicKey, privateKey: k.privateKey }, TTL: 3600, urgency: "normal" },
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      else logger.warn({ err, status }, "push failed");
    }
  }
  return sent;
}
