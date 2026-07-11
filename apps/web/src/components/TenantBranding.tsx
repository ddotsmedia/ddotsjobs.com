'use client';

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { trpc } from '@/lib/trpc/client';

interface TenantContext {
  slug: string;
  name: string;
  logo: string | null;
  features: string[];
}

const defaultCtx: TenantContext = { slug: 'ddotsjobs', name: 'ddotsjobs', logo: null, features: [] };
const Ctx = createContext<TenantContext>(defaultCtx);

// Fetches the current host's tenant branding and applies it as CSS-variable
// overrides on :root. For the default tenant the colours already match, so
// there's no flash; white-label tenants briefly show defaults then re-skin.
export function TenantBranding({ children }: { children: ReactNode }) {
  const q = trpc.tenant.getTenantBranding.useQuery(undefined, { staleTime: 5 * 60_000, refetchOnWindowFocus: false });
  const d = q.data;

  useEffect(() => {
    const colors = d?.colors as { primary?: string; secondary?: string; accent?: string } | undefined;
    if (!colors) return;
    const root = document.documentElement;
    if (colors.primary) {
      root.style.setProperty('--color-brand', colors.primary);
      root.style.setProperty('--accent', colors.primary);
    }
    if (colors.secondary) {
      root.style.setProperty('--color-accent', colors.secondary);
      root.style.setProperty('--brand', colors.secondary);
    }
  }, [d]);

  const value: TenantContext = {
    slug: d?.slug ?? defaultCtx.slug,
    name: d?.name ?? defaultCtx.name,
    logo: d?.logo ?? null,
    features: d?.features ?? [],
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTenant(): TenantContext {
  return useContext(Ctx);
}

// True when the tenant has the named feature enabled. Defaults to true while
// branding is still loading so features aren't hidden on first paint.
export function useTenantFeature(feature: string): boolean {
  const { features } = useContext(Ctx);
  return features.length === 0 || features.includes(feature);
}
