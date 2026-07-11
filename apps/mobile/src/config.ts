import Constants from 'expo-constants';

// Backend base URL. Override per-build via app.json > expo.extra.apiUrl.
export const API_URL = (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'https://ddotsjobs.com';
export const TRPC_URL = `${API_URL}/api/trpc`;
