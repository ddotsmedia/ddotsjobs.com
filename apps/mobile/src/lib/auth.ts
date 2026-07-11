import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const TOKEN_KEY = 'ddotsjobs.session';

// Session token persisted in the device secure store. NOTE: the web backend
// currently authenticates via next-auth cookies, not bearer tokens. A mobile
// token-auth endpoint is required before authed procedures work from the app
// (see README "Backend follow-ups"). Public procedures work today.
export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string | null): Promise<void> {
  try {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

interface AuthState {
  token: string | null;
  ready: boolean;
  hydrate: () => Promise<void>;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  token: null,
  ready: false,
  hydrate: async () => {
    const token = await getToken();
    set({ token, ready: true });
  },
  signIn: async (token) => {
    await setToken(token);
    set({ token });
  },
  signOut: async () => {
    await setToken(null);
    set({ token: null });
  },
}));
