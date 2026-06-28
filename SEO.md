# SEO

**Last updated:** June 2026

## Target keywords
jobs in kerala · kerala jobs 2026 · kerala nursing jobs · kerala it jobs ·
kerala psc jobs 2026 · gulf return jobs kerala · technopark jobs ·
walk in interview kerala · government jobs kerala · teaching jobs kerala · ernakulam jobs

## Pages → primary keyword
| Page | Primary keyword |
|---|---|
| `/` | jobs in kerala 2026 |
| `/jobs` | browse kerala jobs |
| `/jobs/[slug]` | {job title} {district} 2026 |
| `/jobs/[district]` (segment) | jobs in {district} |
| `/jobs/category/[cat]` | {category} jobs kerala |
| `/psc` | kerala psc jobs 2026 |
| `/gulf-return` | gulf return jobs kerala |
| `/technopark-jobs` | technopark jobs trivandrum |
| `/infopark-jobs` / `/cyberpark-jobs` | IT park jobs |

## Implemented
- **Metadata**: keyword-rich titles/descriptions, `keywords`, canonical + OpenGraph on homepage & /jobs; per-job & per-district/category titles (B7). `metadataBase` set.
- **Structured data (JSON-LD)**: Homepage `WebSite` (SearchAction) + `Organization`; job detail `JobPosting` (B7) with hiringOrganization/jobLocation/baseSalary/employmentType/directApply.
- **Sitemap** (`app/sitemap.ts`, dynamic): static routes with priorities (/ 1.0 hourly … /privacy 0.2), all active job slugs + PSC + district + category, `lastModified` from row timestamps.
- **robots.txt** (`app/robots.ts`): allow public, disallow /admin /employer /seeker /api /trpc, sitemap link.
- **Technical**: ISR/force-dynamic (live data), fonts `display:swap` + preload, images width/height + webp/avif, security headers, fast TTFB.
- **Analytics/GSC**: `metadata.verification.google` (env), GA4 component (DNT-respecting, anonymize_ip) — both gated on env vars.

## Deferred (phase 2 — flagged, not yet built)
- Content pages: `/salary-guide`, `/walk-in-interviews`, `/fresher-jobs`.
- Local pages: `/jobs/[district]/[category]` (district×category, generateStaticParams over >0-job combos).
- Breadcrumbs + `BreadcrumbList` JSON-LD on inner pages; "related jobs" + "also hiring" internal-linking sections.
- GA4 custom events (job_view, job_apply_click, search_performed, …).
- Image sitemap entries for job logos; sitemap index when jobs > 1000.
- Category-page keyword intro paragraphs (250+ words); homepage SEO H2.

## Manual (ops)
- Create **Google Business Profile** (Employment Agency, Ddotsmedia Sharjah).
- Set `GOOGLE_SITE_VERIFICATION` + `NEXT_PUBLIC_GA_MEASUREMENT_ID` in `.env.production`, then submit sitemap in Search Console.

## Monthly checklist
- Submit new job slugs / resubmit sitemap in Search Console.
- Review Search Console coverage + Core Web Vitals.
- Refresh salary-guide data; add new district/category pages as volume grows.
