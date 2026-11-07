// Prints a VAPID private key for web push (T2.2) as one .env line. On AWS, Terraform generates it.
import { generateKeyPairSync } from "node:crypto";

const pem = generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey.export({ type: "pkcs8", format: "pem" }).toString().trim();
console.log(`VAPID_PRIVATE_KEY_PEM="${pem.replace(/\n/g, "\\n")}"`);
