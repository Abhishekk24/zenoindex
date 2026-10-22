# Expo Go on Robinhood testnet, against the local testnet API (zenoIndex-backend: ZENO_CHAIN=testnet pnpm dev:mobile).
$env:EXPO_PUBLIC_CHAIN = 'testnet'
$env:EXPO_PUBLIC_API_URL = 'http://172.16.141.93:8788'
npx expo start --clear
