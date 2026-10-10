/**
 * Environment configuration for the zenoIndex-backend API.
 * The app sends the project's PUBLISHABLE key (`pk_live_…`) — safe to ship;
 * every user action still needs that user's own session.
 */
import Constants from 'expo-constants';

/**
 * Base URL of zenoIndex-backend (routes live under `/api/v1`).
 *
 * Examples:
 *   local dev  http://localhost:8787        (Android emulator: http://10.0.2.2:8787)
 *   device     http://192.168.x.x:8787      (backend on the LAN)
 *   hosted     https://api.example.com
 */
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.hostUri
    ? // Derive the dev-server host so a device on the same network can reach a
      // locally running backend without extra config.
      `http://${Constants.expoConfig.hostUri.split(':')[0]}:8787`
    : 'http://localhost:8787')
).replace(/\/$/, '');

export const API_BASE = `${API_URL}/api/v1`;

/** Publishable API key of this app's project. */
export const API_KEY = process.env.EXPO_PUBLIC_API_KEY ?? '';
