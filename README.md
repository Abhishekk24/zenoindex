# ZenoIndex Mobile

Investor app for Zeno: on-chain baskets (DTFs) on Robinhood Chain. The web app
(`programmable-dtf-infra/apps/dtf-app`) is the reference for every screen.

## Development

```bash
npm install
npm start            # Metro
npm run android      # or: npm run ios (run `cd ios && pod install` first)
npm run typecheck
npm run lint
```

The app runs entirely on sample data (`src/lib/data.ts`) for now. On the sign-in
screen, development builds show **Continue as sample investor**; any other email
walks through the new-account steps (terms, then profile), and any 6-digit code
is accepted.

## Fonts

Inter (Regular, Medium, SemiBold, Bold) and Playfair Display Italic live in
`assets/fonts`, named after their PostScript names so one name works on both
platforms. `npx react-native-asset` links them into `android/` and `ios/`
(configured in `react-native.config.js`). Re-run it after adding or removing a
font, then rebuild the app: fonts are native assets, so a Metro reload is not
enough. Licences: `assets/licenses` (SIL OFL 1.1).

## Layout

```
App.tsx                     providers + navigator
src/navigation/             screen flow: sign-in → terms → profile → tabs
src/screens/                Explore, BasketDetail, Portfolio, Profile, auth/*
src/components/             ui primitives, charts, BasketCard, TradePanel
src/lib/api.ts              the only data boundary (sample data today; /api/v1 later)
src/lib/data.ts             development sample data, all in one file
src/lib/decimal.ts          BigInt decimal-string math; money is never a JS float
src/lib/format.ts           display formatting (ported from the web app)
src/lib/types.ts            API shapes copied from @dtf/core-api
src/theme/tokens.ts         black-and-gold tokens and font families from the web redesign
```
