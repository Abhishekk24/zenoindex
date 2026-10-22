// Local API with a separate database and the phone app's existing publishable key.
// pnpm --filter @zenoindex/api dev:mobile http://<computer-LAN-IP>:8788
// ZENO_CHAIN=testnet ... runs it on Robinhood testnet with its own .data/mobile-testnet database.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "node:process";
import { parseEnv } from "node:util";
import { sha256 } from "../src/tenancy";

const apiEnv = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(apiEnv)) loadEnvFile(apiEnv);
const mobileEnv = fileURLToPath(new URL("../../../../zenoIndex-mobile-app/.env", import.meta.url));
const mobile = parseEnv(readFileSync(mobileEnv, "utf8"));
const key = mobile.EXPO_PUBLIC_API_KEY;
if (!key?.startsWith("pk_live_")) throw new Error("Set EXPO_PUBLIC_API_KEY in the sibling mobile app's .env first");
const publicUrl = new URL(process.argv[2] ?? "http://localhost:8788");
if (publicUrl.protocol !== "http:" || publicUrl.pathname !== "/" || publicUrl.username || publicUrl.password || publicUrl.search || publicUrl.hash) {
  throw new Error("Pass only the API origin, e.g. http://192.168.1.10:8788");
}
// These overrides deliberately isolate this run from any configured production DB.
process.env.DATABASE_URL = `pglite:${fileURLToPath(new URL(`../../../.data/mobile${process.env.ZENO_CHAIN === "testnet" ? "-testnet" : ""}`, import.meta.url))}`;
delete process.env.DATABASE_CA_CERT;
process.env.NODE_ENV = "development";
process.env.PORT = publicUrl.port || "80";
process.env.PUBLIC_URL = publicUrl.origin;
process.env.SEED_PROJECT_NAME = "ZenoIndex Mobile Local";
process.env.SEED_PUBLISHABLE_KEY_SHA256 = sha256(key);
delete process.env.SEED_SECRET_KEY_SHA256;
process.env.DEMO_STATS = "false";
console.log(`Local mobile API: ${publicUrl.origin} (separate .data database, chain ${process.env.ZENO_CHAIN ?? "mainnet"})`);
await import("../src/index");
