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

The app talks to the web app's `/api/v1`; set `EXPO_PUBLIC_API_URL` in `.env`
(see `src/lib/env.ts`). Development builds show **Skip sign-in (dev)** on the
sign-in screen to enter as the sample investor without a session.

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
src/lib/api.ts              the data boundary: the web app's /api/v1
src/lib/http.ts             fetch, session cookie, error messages
src/lib/session.tsx         SessionProvider (context in sessionContext.ts)
src/lib/decimal.ts          BigInt decimal-string math; money is never a JS float
src/lib/format.ts, money.ts display formatting ($ amounts in money.ts)
src/lib/types.ts            API shapes copied from @dtf/core-api
src/theme/                  tokens (colours, spacing, fonts) and navigation theme
```

## Mobile Wallet Integration

### Current status

- Expo SDK 57 migration verified.
- Generic device wallet flow uses Reown AppKit + Wagmi.
- Robinhood Chain Testnet is currently configured with chain ID `46630`.
- Wallet connection is available from Profile → Wallets.
- Connected EVM address and chain ID are validated before linking.
- Reown social/email wallet login is disabled because Zeno authentication is handled separately through email sign-in.
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
- Native wallet testing
- Confirm final production network configuration
- Contract transaction integration

### Verification

```bash
npm run typecheck
npx expo export --platform web
