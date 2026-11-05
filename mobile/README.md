# ZenoIndex Mobile

Investor app for Zeno: on-chain baskets (DTFs) on Robinhood Chain. The web app
(`programmable-dtf-infra/apps/dtf-app`) is the reference for every screen.

Expo SDK 57 (React Native 0.86) with Expo Router.

## Development

```bash
npm install
npm start            # then scan the QR code with Expo Go, or press a / i
npm run typecheck
npm run lint
```

Add packages with `npx expo install <package>` so they match the SDK.

The app talks to `zenoIndex-backend` at `/api/v1`; copy `.env.example` to `.env`
and fill in the publishable API key, Privy app/client IDs and Reown project ID.
Set `EXPO_PUBLIC_API_URL` to the hosted API or a phone-reachable local API.
Sign-in uses Privy (email, Google or an external wallet); the backend verifies
its access token and returns a Zeno session.

For a local API against the latest mainnet contracts, run from the sibling
backend repository:

```bash
pnpm --filter @zenoindex/api dev:mobile http://<computer-LAN-IP>:8788
```

Then set `EXPO_PUBLIC_API_URL` to that URL and reload Expo Go. This API uses a
separate local database and the mobile app's existing publishable key. The
phone and computer must be on a mutually reachable network. Localhost on a
physical phone points at the phone itself.

The mainnet integration and phone acceptance checklist are documented in
`../zenoIndex-backend/docs/MAINNET_INTEGRATION.md`.

`ios/` and `android/` are generated (`npx expo prebuild`) and not committed;
configure native behaviour in `app.json`.

## Fonts

The app font is **Space Grotesk** (Light, Regular, Medium, SemiBold, Bold) from
`@expo-google-fonts/space-grotesk`, loaded with `useFonts` in
`src/app/_layout.tsx` (so it also works in Expo Go). Each weight is its own
family; use `fonts` from `src/theme/tokens.ts` and never set `fontWeight`.

## Code structure

One component per file; hooks live in `src/hooks/`, one per file.

```
src/app/                    routes (Expo Router); every file is a screen
  _layout.tsx               providers, fonts, splash
  sign-in · terms · complete-profile · search
  (tabs)/                   Explore (index) · Portfolio · Profile
  basket/[id].tsx           basket detail and Invest/Redeem
src/components/
  ui/                       shared primitives (Button, Card, Screen, UnderlineTabs…), index.ts re-exports
  icons/                    one icon per file, index.ts re-exports
  navigation/               RootStack (sign-in stages), TabBarBackground
  AppHeader.tsx             logo, title and header actions
  auth/ explore/ search/ basket/ portfolio/ profile/   screen-specific parts
  charts/                   NavChart, AllocationBar
src/hooks/                  useLoad, useSession, useUser, useSlide, useKeyboardHeight
src/lib/api.ts              the data boundary: zenoIndex-backend /api/v1
src/lib/http.ts             fetch, session cookie, error messages
src/lib/session.tsx         SessionProvider (context in sessionContext.ts)
src/lib/decimal.ts          BigInt decimal-string math; money is never a JS float
src/lib/format.ts, money.ts display formatting ($ amounts in money.ts)
src/lib/types.ts            mobile API shapes
src/theme/                  tokens (colours, spacing, fonts) and navigation theme
```

## Mobile Wallet Integration

### Current status

- Expo SDK 57 migration verified.
- Generic device wallet flow uses Reown AppKit + Wagmi.
- Transactions use Robinhood Chain **mainnet**, chain ID `4663`, with USDG (6 decimals).
- Email / Google sign-in uses a Privy embedded Ethereum wallet; wallet sign-in uses Reown AppKit.
- Privy authenticates all sign-ins, including external wallets via SIWE. Reown connects external wallets and requests their signatures; Robinhood RPC reads use the direct URL in `src/config/chains.ts`.
- The backend prepares unsigned transactions and verifies mined transactions against each prepared operation.
- Creation, seed approval/deposit, investing, deploying allocations, rebalancing, redeeming and fee claims are integrated.
- Redeeming signs a request, one swap per stock, and a final USDG claim.
- Wallet reply recovery requires a matching sender, target and calldata in a later block, so earlier redemption steps cannot complete the next one.
- Expo Go wallet callbacks use `exp://…/--/wc-return`; native builds use `zeno://wc-return`.
- Solana Kit + Wallet UI dependencies are installed as the foundation for the Solana/Seeker flow.

### Device-specific wallet architecture

Generic Device:
- Reown AppKit
- Wagmi / viem
- Robinhood EVM

Solana Device / Seeker:
- Solana Mobile Wallet Adapter
- Solana wallet flow is separate from Reown

### Remaining work

- Device detection
- Solana Mobile Wallet Adapter integration
- Physical-phone wallet handoff and live transaction acceptance on the latest deployment

### Verification

```bash
npm run typecheck
npm run lint
npm test
npx expo export --platform web
npx expo export --platform android
```
