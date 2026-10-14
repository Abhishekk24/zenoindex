// Polyfills must load before any other module, so the app starts here:
// Privy's (TextEncoder, crypto.getRandomValues, ethers shims), then
// WalletConnect's for Reown AppKit (URL, Buffer, …).
import 'fast-text-encoding';
import 'react-native-get-random-values';
import '@ethersproject/shims';
import '@walletconnect/react-native-compat';
import 'expo-router/entry';
