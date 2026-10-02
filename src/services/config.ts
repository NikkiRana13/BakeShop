import { Platform } from 'react-native';

/**
 * Where the vendor-search server runs (see ../../server). The Android
 * emulator reaches the host computer at 10.0.2.2; the iOS simulator can use
 * localhost. On a physical phone, use your computer's address on the same
 * Wi-Fi, e.g. http://192.168.1.20:8787.
 */
export const API_BASE_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:8787' : 'http://localhost:8787';

/**
 * When false, vendor search uses the sample data in src/data/demoVendors.ts
 * without trying the server. When true, it tries the server first and falls
 * back to the sample data if the server is off, slow or missing keys.
 */
export const USE_LIVE_API = true;
