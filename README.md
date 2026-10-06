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

The app runs entirely on sample data (`src/lib/data.ts`) for now. On the sign-in
screen, development builds show **Continue as sample investor**; any other email
walks through the new-account steps (terms, then profile), and any 6-digit code
is accepted.

`ios/` and `android/` are generated (`npx expo prebuild`) and not committed;
configure native behaviour in `app.json`.

## Fonts

Inter (Regular, Medium, SemiBold, Bold) and Playfair Display Italic live in
`assets/fonts` and load with `useFonts` in `src/app/_layout.tsx` (so they also
work in Expo Go). Each weight is its own family; see `fonts` in
`src/theme/tokens.ts`. Licences: `assets/licenses` (SIL OFL 1.1).

## Layout

```
src/app/                    routes (Expo Router); every file is a screen
  _layout.tsx               fonts, theme, and the sign-in stages
  sign-in · terms · complete-profile
  (tabs)/                   Explore (index) · Portfolio · Profile
  basket/[id].tsx           basket detail and Invest/Redeem
src/components/             ui primitives, charts, BasketCard, TradePanel
src/lib/api.ts              the only data boundary (sample data today; /api/v1 later)
src/lib/data.ts             development sample data, all in one file
src/lib/decimal.ts          BigInt decimal-string math; money is never a JS float
src/lib/format.ts           display formatting (ported from the web app)
src/lib/session.tsx         signed-in user and onboarding stage
src/lib/types.ts            API shapes copied from @dtf/core-api
src/theme/tokens.ts         black-and-gold tokens and font families
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
