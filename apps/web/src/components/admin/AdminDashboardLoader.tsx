'use client';

import dynamic from 'next/dynamic';

// Defer the (client-only) admin dashboard bundle — keeps it out of the initial
// payload and shows a skeleton while the chunk loads.
const AdminDashboard = dynamic(() => import('./AdminDashboard').then((m) => m.AdminDashboard), {
  ssr: false,
  loading: () => (
    <div style={{ minHeight: '100dvh', background: '#0F0E0C', color: '#9a9a92', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)' }}>
      Loading dashboard…
    </div>
  ),
});

export function AdminDashboardLoader() {
  return <AdminDashboard />;
}
