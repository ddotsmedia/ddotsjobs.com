import Script from 'next/script';

// GA4 — loaded only when NEXT_PUBLIC_GA_MEASUREMENT_ID is set. No PII sent;
// IP anonymization on. Respect Do-Not-Track at the client before init.
export function Analytics() {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!id) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          if (navigator.doNotTrack !== '1' && window.doNotTrack !== '1') {
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${id}', { anonymize_ip: true });
          }
        `}
      </Script>
    </>
  );
}
