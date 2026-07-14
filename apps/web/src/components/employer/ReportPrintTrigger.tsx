'use client';

import { useEffect } from 'react';

// Opens the browser print dialog once the report has rendered. Users "Save as PDF".
export function ReportPrintTrigger() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="no-print" style={{ textAlign: 'center', margin: '16px 0' }}>
      <button type="button" onClick={() => window.print()} style={{ background: '#3A9EA5', color: '#fff', border: 'none', borderRadius: 999, padding: '10px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
        Print / Save as PDF
      </button>
    </div>
  );
}
