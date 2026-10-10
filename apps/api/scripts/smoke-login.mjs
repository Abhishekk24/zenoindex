// Smoke test of a running API, as the phone sees it. Throwaway wallet, no funds, no transactions.
// Usage: node scripts/smoke-login.mjs <api base url> <path to the mobile app .env with EXPO_PUBLIC_API_KEY>
import { readFileSync } from "node:fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const [base, mobileEnv] = process.argv.slice(2);
const key = readFileSync(mobileEnv, "utf8").match(/^EXPO_PUBLIC_API_KEY=(.+)$/m)[1].trim();
const call = async (path, body, token) => {
  const res = await fetch(`${base}/api/v1${path}`, {
    method: body ? "POST" : "GET",
    headers: { "x-api-key": key, "content-type": "application/json", ...(token && { cookie: `dtf_session=${token}` }) },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({ nonJson: true })) };
};

console.log("health", (await fetch(`${base}/health`)).status);
console.log("no key", (await fetch(`${base}/api/v1/dtfs`)).status);
const dtfs = await call("/dtfs");
console.log("dtfs", dtfs.status, "items:", dtfs.json.items?.length);
const chains = await call("/chains");
console.log("chains", chains.status, JSON.stringify(chains.json.items?.map((c) => c.chainId)));

const account = privateKeyToAccount(generatePrivateKey());
const nonce = await call("/auth/siwe/nonce", { walletAddress: account.address, chainId: 4663 });
console.log("nonce", nonce.status, "| message domain line:", nonce.json.message?.split("\n")[0]);
const signature = await account.signMessage({ message: nonce.json.message });
const login = await call("/auth/siwe/verify", { message: nonce.json.message, signature });
console.log("verify", login.status, "user wallet matches:", login.json.user?.walletAddress === account.address.toLowerCase(), "token:", Boolean(login.json.token));
const token = login.json.token;
console.log("me", (await call("/auth/me", undefined, token)).json.user?.id === login.json.user?.id);
const terms = await call("/auth/accept-terms", { terms: true, privacy: true }, token);
console.log("terms", terms.status, Boolean(terms.json.user?.termsAcceptedAt));
const profile = await call("/auth/profile", { firstName: "Smoke", lastName: "Test", country: "IN" }, token);
console.log("profile", profile.status, profile.json.user?.displayName);
const portfolio = await call(`/wallets/${account.address.toLowerCase()}/portfolio`, undefined, token);
console.log("portfolio", portfolio.status, "positions:", portfolio.json.positions?.length);
const replay = await call("/auth/siwe/verify", { message: nonce.json.message, signature });
console.log("replay rejected", replay.status === 401);
