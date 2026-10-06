/**
 * Environment configuration. The app talks only to the hosted app's
 * `/api/v1` proxy — it holds `CORE_API_KEY` server-side, so the app never
 * needs (and must never receive) a core API key.
 */
import Constants from 'expo-constants';

/**
 * Base URL of the hosted app that owns the `/api/v1` proxy.
 *
 * Examples:
 *   local dev  http://localhost:5174        (Metro on the same machine;
 *                                            Android emulator: http://10.0.2.2:5174)
 *   device     http://192.168.x.x:5174      (dev server on the LAN)
 *   hosted     https://app.example.com
 */
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.hostUri
    ? // Derive the dev-server host so a device on the same network can reach a
      // locally hosted dtf-app without extra config.
      `http://${Constants.expoConfig.hostUri.split(':')[0]}:5174`
    : 'http://localhost:5174')
).replace(/\/$/, '');

export const API_BASE = `${API_URL}/api/v1`;
