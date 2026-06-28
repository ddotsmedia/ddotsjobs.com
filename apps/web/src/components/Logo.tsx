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
        d="M10 4 C4 4 2 8 2 12 L2 60 C2 64 4 68 10 68 L28 68 C46 68 58 56 58 36 C58 16 46 4 28 4 Z"
        stroke={stroke}
        strokeWidth="3"
        fill="none"
      />
      <circle cx="18" cy="20" r="11" fill="#F5C842" />
      <circle cx="40" cy="20" r="11" fill="#E8623A" />
      <circle cx="18" cy="52" r="11" fill="#8DC63F" />
      <circle cx="40" cy="52" r="11" fill="#F5C842" />
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
