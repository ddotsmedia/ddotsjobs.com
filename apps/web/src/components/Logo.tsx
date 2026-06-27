'use client';

import Link from 'next/link';

// Ddotsmedia D-mark: teal rounded-left/pointed-right outline + 4 brand circles.
export function Logo({
  size = 'md',
  showText = true,
  href = '/',
  variant = 'default',
}: {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  href?: string;
  variant?: 'default' | 'white';
}) {
  const h = size === 'sm' ? 28 : size === 'lg' ? 56 : 36;
  const w = Math.round((h * 60) / 72);
  const textColor = variant === 'white' ? '#FFFFFF' : '#3A9EA5';
  const stroke = variant === 'white' ? '#FFFFFF' : '#3A9EA5';

  const logoMark = (
    <svg width={w} height={h} viewBox="0 0 60 72" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flex: '0 0 auto' }} role="img" aria-label="ddotsjobs">
      <path
        d="M8 4 C4 4 2 6 2 10 L2 62 C2 66 4 68 8 68 L32 68 C48 68 58 58 58 36 C58 14 48 4 32 4 Z"
        stroke={stroke}
        strokeWidth="2.5"
        fill="none"
      />
      <circle cx="18" cy="22" r="11" fill="#F5C842" />
      <circle cx="40" cy="22" r="11" fill="#E8623A" />
      <circle cx="18" cy="50" r="11" fill="#8DC63F" />
      <circle cx="40" cy="50" r="11" fill="#F5C842" />
    </svg>
  );

  const content = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: size === 'sm' ? 6 : 8, textDecoration: 'none' }}>
      {logoMark}
      {showText && (
        <span
          style={{
            fontWeight: 700,
            fontSize: size === 'sm' ? 14 : size === 'lg' ? 24 : 18,
            letterSpacing: '-0.03em',
            color: textColor,
            fontFamily: 'var(--font-sans)',
            lineHeight: 1,
          }}
        >
          ddotsjobs
        </span>
      )}
    </span>
  );

  if (!href) return content;
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      {content}
    </Link>
  );
}
