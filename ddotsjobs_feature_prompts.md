# ddotsjobs.com — Full Feature Build Prompts
# 40 Features across 10 Phases
# VPS: 194.164.151.202 | Path: /opt/ddotsjobs | Port: 3107 | PG: 5436

---

## UNIVERSAL LAW (prepend to every Claude Code session)

```
Session rules:
- No pnpm db:seed (use pnpm db:seed:demo only)
- Additive migrations only — never drop columns/tables
- Never touch other VPS projects (ayurconnect, ddotsmediajobs, gayathi, healthportal, ddotshop, erp)
- rm -rf apps/web/.next before every VPS build
- After build: copy static files into standalone output directory
- Mobile-first, TypeScript strict mode
- Haiku default AI (callAI() in packages/ai/src/client.ts), Sonnet only for complex logic
- One feature per prompt, build + commit + push + deploy after each task
- Deploy: bash /opt/ddotsjobs/run-deploy.sh
- DB: PGPASSWORD=ddots123 psql -h 127.0.0.1 -U ddots -d ddotsjobs -p 5436
- Admin login: /admin-login | username: ddotsadmin
- Brand colors: use existing Tailwind config (check tailwind.config.ts)
- Always ON CONFLICT DO NOTHING in seed/insert scripts
- Always backup DB before migrations: pg_dump -h 127.0.0.1 -U ddots -p 5436 ddotsjobs > /opt/ddotsjobs/backups/pre-migration-$(date +%Y%m%d%H%M).sql
```

---

## PHASE 1 — Job Seeker Core (JS1–JS3)

### PROMPT 1A — JS1: Smart Resume Builder

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Feature: Smart Resume Builder (JS1)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

Build a Kerala-format resume builder for job seekers.

MIGRATION (additive only):
- Table: resume_profiles
  - id, user_id (FK seekers), title, summary, experience (jsonb), education (jsonb),
    skills (text[]), languages (text[]), certifications (jsonb),
    template_id (varchar default 'kerala-classic'),
    is_public (bool default false), created_at, updated_at

BACKEND (tRPC router: apps/web/src/server/routers/resume.ts):
- resume.create — create resume profile
- resume.update — update sections
- resume.getByUser — fetch user's resumes
- resume.generateSummary — call callAI() to generate professional summary from experience input
- resume.export — returns structured data for PDF generation

PAGE: /dashboard/resume-builder
- Multi-step form: Personal Info → Experience → Education → Skills → Preview
- Malayalam name/address fields supported (Unicode)
- 3 templates: Kerala Classic, Modern Minimal, Gulf-Ready
- Live preview panel (desktop split, mobile tab toggle)
- "Enhance with AI" button on summary and each experience description (calls generateSummary)
- Export as PDF button (use @react-pdf/renderer or html2canvas → jsPDF)
- Save draft auto-saves every 30 seconds

After build: commit "feat: smart resume builder JS1", push, deploy.
Verify page loads at /dashboard/resume-builder before reporting done.
```

---

### PROMPT 1B — JS2: Job Alert Engine

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Feature: Job Alert Engine (JS2)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

Build job alert subscriptions with email + WhatsApp delivery.

MIGRATION (additive only):
- Table: job_alerts
  - id, user_id (FK seekers), name (varchar), keywords (text[]),
    category_id (FK, nullable), district (varchar nullable),
    salary_min (int nullable), salary_max (int nullable),
    job_type (varchar nullable), frequency (enum: 'instant','daily','weekly'),
    channel (enum array: 'email','whatsapp'), is_active (bool default true),
    last_sent_at (timestamptz), created_at

BACKEND:
- tRPC router: job_alerts.ts — CRUD for alerts
- BullMQ job: alert-processor (check existing queue setup in packages/jobs/)
  - Daily job at 8AM IST: query new jobs matching each alert, send email via Resend
  - WhatsApp: POST to Green API (check existing Green API config in .env)
  - Instant: trigger on new job post if matching alerts exist

PAGE: /dashboard/job-alerts
- List of active alerts with toggle on/off
- Create alert modal: keywords, category, district dropdown (14 Kerala districts),
  salary range slider, job type, frequency, channel checkboxes
- "Preview matching jobs" shows live count before saving
- Alert history tab: last 10 sends per alert with job count

After build: commit "feat: job alert engine JS2", push, deploy.
```

---

### PROMPT 1C — JS3: Application Tracker

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Feature: Application Tracker (JS3)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

Build a Kanban-style application tracking board for job seekers.

CHECK FIRST: Does applications table exist? Run:
psql -h 127.0.0.1 -U ddots -p 5436 ddotsjobs -c "\d applications"
If yes, add columns additively. If no, create fresh.

MIGRATION (additive only):
- Add to applications table (or create):
  - status (enum: 'saved','applied','viewed','shortlisted','interview','offered','rejected','withdrawn')
  - notes (text nullable)
  - interview_date (timestamptz nullable)
  - offer_amount (int nullable)
  - seeker_rating (int nullable 1-5)
  - last_status_change (timestamptz)

BACKEND (tRPC router: applications.ts):
- applications.getBoard — fetch all applications grouped by status for logged-in seeker
- applications.updateStatus — move card between columns, log timestamp
- applications.addNote — add note to application
- applications.setInterview — set interview date + reminder

PAGE: /dashboard/applications
- Kanban board: 8 columns (Saved → Applied → Viewed → Shortlisted → Interview → Offered → Rejected → Withdrawn)
- Drag-and-drop cards using @dnd-kit/core (install if not present)
- Card shows: company logo, job title, applied date, days since last update
- Click card → side panel: full details, notes editor, interview date picker
- Mobile: vertical list view with status badge + swipe to change status
- Stats bar: total applied, in progress, interview rate, offer rate
- Color-coded columns (green for positive stages, red for rejected)

After build: commit "feat: application tracker kanban JS3", push, deploy.
```

---

## PHASE 2 — Job Seeker Advanced (JS4–JS6)

### PROMPT 2A — JS4: Career Path Planner

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Feature: Career Path Planner (JS4)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

Build an AI-powered career path planning tool.

MIGRATION (additive only):
- Table: career_plans
  - id, user_id (FK seekers), current_role (varchar), target_role (varchar),
    current_skills (text[]), skill_gaps (jsonb), roadmap (jsonb),
    timeline_months (int), created_at, updated_at

BACKEND (tRPC):
- careerPlan.generate — takes current_role, current_skills, target_role →
  calls callAI() with Kerala job market context →
  returns: skill gaps, learning resources, timeline, salary progression
- careerPlan.save — save generated plan
- careerPlan.getLatest — fetch user's latest plan

PAGE: /tools/career-planner (also link from /dashboard)
- Step 1: Current role input + skills multi-select (tag input)
- Step 2: Target role input (autocomplete from job categories)
- Step 3: AI generates visual roadmap
  - Timeline visualization: months 1-3, 4-6, 7-12, 12+
  - Skill gap cards with free learning resource links (YouTube, NPTEL, Kerala IT Mission)
  - Salary progression chart (use recharts)
  - Kerala-specific context: PSC paths, Gulf opportunities, IT parks
- Save plan + share as image button
- "Find jobs matching target role" CTA → links to job search

Use Haiku for generation. Prompt must include Kerala job market context.
After build: commit "feat: career path planner JS4", push, deploy.
```

---

### PROMPT 2B — JS5: Salary Negotiation Coach

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Feature: Salary Negotiation Coach (JS5)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

Build an AI salary negotiation coach with role-play simulation.

MIGRATION (additive only):
- Table: negotiation_sessions
  - id, user_id, job_title, current_offer (int), target_salary (int),
    experience_years (int), conversation (jsonb array), outcome (varchar),
    created_at

BACKEND (tRPC):
- negotiation.start — create session with job context
- negotiation.chat — multi-turn AI conversation
  System prompt: "You are a tough but fair Kerala employer HR manager.
  The candidate is negotiating salary. Be realistic about Kerala market rates.
  Give pushback but allow negotiation. After 5 turns, suggest a final number."
- negotiation.getSalaryBenchmark — returns Kerala market range for role+experience

PAGE: /tools/salary-coach
- Input form: job title, current offer, years of experience, target salary
- Chat interface (like WhatsApp style bubbles)
- Live salary benchmark widget: shows min/median/max for role in Kerala + Gulf
- Negotiation tips sidebar (desktop) / collapsible (mobile)
- Session summary at end: what worked, what to improve, final recommended ask
- "Share result" generates a card image

Use Haiku. Include Kerala + Gulf salary context in system prompt.
After build: commit "feat: salary negotiation coach JS5", push, deploy.
```

---

### PROMPT 2C — JS6: Gulf Returnee Hub

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Feature: Gulf Returnee Hub (JS6)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

Build a dedicated section for Gulf returnees reintegrating into Kerala job market.

MIGRATION (additive only):
- Add to seekers table (if not present):
  - is_gulf_returnee (bool default false)
  - gulf_country (varchar nullable)
  - gulf_years (int nullable)
  - returnee_skills (text[] nullable)

BACKEND (tRPC):
- returnee.updateProfile — mark seeker as returnee + add gulf details
- returnee.getJobs — fetch jobs tagged returnee-friendly or matching gulf skills
- returnee.getResources — static curated resources (NORKA, ODEPC, KASE schemes)
- returnee.skillMap — callAI() to map Gulf job title → Kerala equivalent titles

PAGE: /gulf-returnee (public landing) + /dashboard/returnee-profile
Public landing (/gulf-returnee):
- Hero: "Welcome Home. Your Gulf Experience Has Value Here."
- 4 sections: Skill Mapping Tool, NORKA Schemes, Featured Returnee Jobs, Success Stories
- Skill mapper: enter Gulf job title → AI returns 3 matching Kerala job titles + salary range
- NORKA scheme cards: Pravasi Welfare Fund, ODEPC, Re-employment assistance (links)
- Featured jobs filtered by returnee-friendly tag

Dashboard (/dashboard/returnee-profile):
- Toggle "I am a Gulf Returnee" → unlocks returnee profile section
- Gulf country selector, years abroad, roles held
- "Map my skills" button → calls returnee.skillMap
- Returnee badge on public profile

After build: commit "feat: gulf returnee hub JS6", push, deploy.
```

---

## PHASE 3 — Job Seeker Utility (JS7–JS10)

### PROMPT 3A — JS7: PSC Exam Prep Center

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Feature: PSC Exam Prep Center (JS7)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

Build a PSC exam preparation and notification tracking center.

MIGRATION (additive only):
- Table: psc_notifications
  - id, title, post_name, department, notification_date, last_date,
    vacancy_count (int), category (varchar), syllabus_url, official_url,
    district (varchar nullable), is_active (bool default true), created_at

- Table: psc_mock_tests
  - id, title, subject, questions (jsonb array of {question, options[4], correct_index, explanation}),
    duration_minutes (int), difficulty (enum: easy/medium/hard), created_at

- Table: psc_test_attempts
  - id, user_id, test_id, answers (jsonb), score (int), total (int),
    time_taken_seconds (int), created_at

BACKEND (tRPC):
- psc.listNotifications — paginated, filter by category/district/active
- psc.getMockTests — list available tests
- psc.startTest — return questions (shuffle options)
- psc.submitTest — score answers, store attempt, return results with explanations
- psc.generateQuestion — callAI() to generate 5 PSC-style questions on a topic

PAGES:
/psc-prep (public):
- Latest PSC notifications table: post, dept, vacancies, last date, apply link
- Filter by district, category (LDC, LGS, Degree Level, etc.)
- "Notify me" button → email alert on new notifications

/psc-prep/mock-test (auth):
- Test list with subject, questions count, difficulty badge
- Timer-based test interface (fullscreen option)
- Auto-submit on timeout
- Results page: score, rank simulation, answer review with explanations
- Performance history chart (recharts)

Admin: add PSC notification form at /admin/psc

After build: commit "feat: psc exam prep center JS7", push, deploy.
```

---

### PROMPT 3B — JS8: Profile Strength Meter

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Feature: Profile Strength Meter (JS8)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

Build a profile completeness scoring system for job seekers.

NO NEW MIGRATION needed — reads from existing seekers/resume_profiles tables.

BACKEND (tRPC):
- profile.getStrength — calculates score 0-100 based on:
  - Photo uploaded: +10
  - Headline/title filled: +10
  - Summary > 100 chars: +10
  - At least 1 work experience: +15
  - Education filled: +10
  - Skills > 3 added: +10
  - Resume uploaded or built: +15
  - Phone verified: +10
  - District set: +5
  - Gulf returnee profile (if applicable): +5
  Returns: { score, level, missingItems[], completedItems[] }

- profile.getStrengthTips — callAI() returns 3 personalized improvement tips based on missing items

COMPONENT: ProfileStrengthMeter (apps/web/src/components/profile/ProfileStrengthMeter.tsx)
- Circular progress ring with score in center
- Color: 0-40 red, 41-70 orange, 71-100 green
- Level labels: Starter / Growing / Strong / Expert
- Checklist of completed ✅ and missing ❌ items
- "Get AI Tips" button → loads personalized suggestions
- Embed on: /dashboard (sidebar widget), /profile/edit (top banner)

Mobile: compact horizontal bar version for dashboard cards.
Show "Your profile is X% complete — employers prefer 80%+ profiles" nudge.

After build: commit "feat: profile strength meter JS8", push, deploy.
```

---

### PROMPT 3C — JS9: Saved Job Collections

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Feature: Saved Job Collections (JS9)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

Build a saved jobs folder/collection system.

MIGRATION (additive only):
- Table: job_collections
  - id, user_id (FK seekers), name (varchar), color (varchar default '#3B82F6'),
    icon (varchar default 'bookmark'), created_at

- Table: job_collection_items
  - id, collection_id (FK), job_id (FK jobs), notes (text nullable),
    added_at (timestamptz default now())
  - UNIQUE(collection_id, job_id)

BACKEND (tRPC — router: collections.ts):
- collections.list — user's collections with job count
- collections.create — new collection (name, color, icon)
- collections.addJob — add job to collection (create "Saved" default if none exists)
- collections.removeJob — remove from collection
- collections.getJobs — jobs in a collection with pagination
- collections.delete — delete collection (not default "Saved")

UI CHANGES:
1. Job cards (existing): add bookmark icon button → on click:
   - If one collection: save directly to default
   - If multiple: show mini dropdown to pick collection
   - Filled bookmark = saved, outline = unsaved (optimistic update)

2. New page /dashboard/saved-jobs:
   - Left sidebar: collection list with color dots + job count
   - Main: job cards for selected collection
   - Create collection button (name + color picker + emoji icon)
   - Bulk actions: remove selected, move to another collection
   - Empty state: "No saved jobs yet — browse jobs and bookmark them"

After build: commit "feat: saved job collections JS9", push, deploy.
```

---

### PROMPT 3D — JS10: Interview Scheduler

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Feature: Interview Scheduler (JS10)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

Build interview invite management for job seekers.

MIGRATION (additive only):
- Table: interview_invites
  - id, application_id (FK), employer_id (FK employers), seeker_id (FK seekers),
    job_id (FK jobs), scheduled_at (timestamptz), duration_minutes (int default 30),
    mode (enum: 'in_person','video','phone','whatsapp'),
    location (text nullable), video_link (text nullable),
    notes (text nullable),
    status (enum: 'pending','accepted','declined','rescheduled','completed','no_show'),
    seeker_confirmed_at (timestamptz nullable),
    reminder_sent (bool default false), created_at, updated_at

BACKEND (tRPC):
- interview.getUpcoming — seeker's upcoming interviews sorted by date
- interview.respond — accept / decline / request reschedule
- interview.complete — mark as completed + optional rating of experience
- interview.sendReminder — BullMQ job: WhatsApp/email reminder 24h before
- interview.getPrep — callAI() generates interview prep tips for the specific job/company

PAGES:
/dashboard/interviews:
- Calendar view (month/week toggle) showing scheduled interviews
- List view: company, role, date/time, mode badge, status badge
- Accept/Decline buttons for pending invites
- Click interview → side panel:
  - Full details (location / video link)
  - "Prep with AI" button → streams interview tips for this specific role
  - Add to Google Calendar link (generate .ics)
  - Notes editor (seeker private)
  - Request reschedule form

Notification: when employer creates invite → seeker gets WhatsApp + email.
After build: commit "feat: interview scheduler JS10", push, deploy.
```

---

## PHASE 4 — Employer CRM (E1–E3)

### PROMPT 4A — E1: Applicant Pipeline CRM

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Feature: Applicant Pipeline CRM (E1)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

Build a full applicant tracking Kanban CRM for employers.

MIGRATION (additive only):
- Add to applications table:
  - employer_notes (text nullable)
  - employer_rating (int nullable 1-5)
  - pipeline_stage (enum: 'new','screening','shortlisted','interview_scheduled',
    'interview_done','offer_sent','hired','rejected') default 'new'
  - stage_updated_at (timestamptz)
  - tags (text[] default '{}')

- Table: application_timeline
  - id, application_id, changed_by (FK users), from_stage, to_stage,
    note (text nullable), created_at

BACKEND (tRPC — employer router):
- employer.getPipeline — all applications grouped by pipeline_stage for a job
- employer.moveStage — update stage, log to timeline
- employer.addNote — add employer note
- employer.rateApplicant — set rating 1-5
- employer.getTimeline — full stage history for an application

PAGE: /employer/pipeline/[jobId]
- Kanban board with 8 stages
- Each card: seeker photo, name, headline, applied date, rating stars
- Drag to move stages (dnd-kit)
- Click card → full side panel:
  - CV viewer (embedded PDF or structured resume)
  - AI match score + explanation (call existing job match AI tool)
  - Stage timeline history
  - Notes + tags
  - Action buttons: Schedule Interview, Send WhatsApp, Reject, Hire
- Filter bar: rating, date range, has-resume, tags
- Bulk select + bulk move stage
- Export filtered list as CSV

Mobile: vertical list grouped by stage with swipe-to-move.
After build: commit "feat: applicant pipeline CRM E1", push, deploy.
```

---

### PROMPT 4B — E2: Bulk Job Import

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Feature: Bulk Job Import (E2)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

Build CSV/Excel bulk job upload for employers.

NO NEW MIGRATION — uses existing jobs table.
Add column: import_batch_id (varchar nullable) if not exists.

BACKEND:
- tRPC: employer.bulkImport — accepts parsed rows, validates, inserts jobs
- Validation rules: title required, category must match existing, salary numeric,
  district must be one of 14 Kerala districts
- Returns: { success: number, errors: [{row, reason}] }
- BullMQ job for large batches (>50 jobs): process async, notify on completion

CSV TEMPLATE columns:
title, description, category, district, job_type (fulltime/parttime/contract/internship),
salary_min, salary_max, experience_min, experience_max, skills (semicolon separated),
deadline, is_walk_in (true/false), walk_in_date, walk_in_venue

PAGE: /employer/jobs/import
- Step 1: Download CSV template button
- Step 2: Upload CSV or XLSX (use xlsx package to parse Excel)
- Step 3: Preview table — first 10 rows with validation highlights
  - Green rows: valid
  - Red rows: show error reason inline
- Step 4: Confirm import → progress bar → results summary
- Import history table: date, file name, total/success/failed counts
- "Fix errors" downloads error rows as CSV for correction

Admin can also access at /admin/jobs/import for bulk seeding.
After build: commit "feat: bulk job import E2", push, deploy.
```

---

### PROMPT 4C — E3: Employer Branding Page

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Feature: Employer Branding Page (E3)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

Build public employer profile / company page.

MIGRATION (additive only):
- Add to employers table:
  - tagline (varchar nullable)
  - about (text nullable)
  - culture (text nullable)
  - benefits (text[] default '{}')
  - team_size (varchar nullable) -- '1-10','11-50','51-200','201-500','500+'
  - founded_year (int nullable)
  - headquarters (varchar nullable)
  - social_linkedin (varchar nullable)
  - social_instagram (varchar nullable)
  - gallery_images (text[] default '{}')  -- URLs
  - video_url (varchar nullable)
  - is_verified (bool default false)
  - profile_views (int default 0)

BACKEND (tRPC):
- employer.updateBranding — update all branding fields
- employer.getPublicProfile — public company data + active jobs
- employer.uploadGallery — handle image upload to /public/uploads/employers/
- employer.trackView — increment profile_views

PUBLIC PAGE: /company/[slug]
- Hero banner: cover photo or gradient with logo overlay
- Company info: tagline, size, founded, HQ, industry
- About section + Culture section
- Benefits chips: Health Insurance, Remote Work, Bonus, etc.
- Photo gallery grid (lightbox on click)
- Embedded video (YouTube/Vimeo)
- Active jobs list (paginated)
- Verified badge if is_verified=true
- Social links
- "Follow this company" button → seeker can subscribe to new job alerts

EMPLOYER DASHBOARD: /employer/branding
- Edit all fields with live preview
- Gallery upload (multiple images, drag to reorder)
- Profile views analytics widget
- "Preview public page" button

After build: commit "feat: employer branding page E3", push, deploy.
```

---

## PHASE 5 — Employer Tools (E4–E6)

### PROMPT 5A — E4: Screening Questions

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Feature: Screening Questions (E4)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

Build custom screening questionnaire for job applications.

MIGRATION (additive only):
- Table: screening_questions
  - id, job_id (FK jobs), question (text), type (enum: 'text','yes_no','multiple_choice','number'),
    options (text[] nullable), is_required (bool default true), is_knockout (bool default false),
    knockout_answer (text nullable), sort_order (int), created_at

- Table: screening_answers
  - id, application_id (FK), question_id (FK), answer (text), created_at
  - UNIQUE(application_id, question_id)

BACKEND (tRPC):
- screening.setQuestions — replace questions for a job (delete+insert)
- screening.getQuestions — fetch for a job
- screening.submitAnswers — called when seeker applies (after application insert)
- screening.getAnswers — employer fetches answers per application
- screening.generateQuestions — callAI() suggests 5 relevant screening questions for a job title/description
- screening.autoFilter — mark applications as knockout if knockout answers don't match

EMPLOYER: /employer/jobs/[jobId]/screening
- Question builder: drag-to-reorder, add/remove questions
- Question types: text, yes/no toggle, multiple choice (add options), numeric
- Knockout toggle: "Auto-reject if answered X" → set knockout_answer
- "Generate with AI" → suggests questions based on job description
- Preview as applicant

SEEKER APPLY FLOW:
- If job has screening questions, show them after application form
- Required questions must be answered to submit
- Yes/No knockout questions: show warning "This may affect eligibility"

EMPLOYER CRM: show screening answers in applicant side panel (from E1).
After build: commit "feat: screening questions E4", push, deploy.
```

---

### PROMPT 5B — E5: Candidate Shortlisting AI

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Feature: Candidate Shortlisting AI (E5)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

Build AI-powered candidate ranking for employers.

MIGRATION (additive only):
- Add to applications table:
  - ai_match_score (int nullable 0-100)
  - ai_match_summary (text nullable)
  - ai_scored_at (timestamptz nullable)

BACKEND (tRPC):
- shortlist.scoreAll — BullMQ job: score all unscored applications for a job
  For each application:
  1. Fetch job requirements (title, skills, experience, description)
  2. Fetch seeker profile (headline, skills, experience, education)
  3. Call callAI() with Haiku:
     Prompt: "Score this candidate 0-100 for this job. Return JSON:
     {score: number, summary: string (2 sentences), strengths: string[], gaps: string[]}"
  4. Update ai_match_score + ai_match_summary
- shortlist.getScored — applications sorted by ai_match_score desc
- shortlist.scoreOne — score a single application immediately

EMPLOYER PIPELINE (update E1):
- Add "AI Score" column to pipeline cards: colored badge (green 70+, orange 40-70, red <40)
- "Score All Candidates" button on pipeline page → triggers BullMQ batch job
  → progress bar shows scoring in real time via polling
- Sort pipeline by AI score
- Click score badge → modal shows: score breakdown, strengths, gaps

Batch processing: process max 10 at a time with 500ms delay between calls
to stay within Haiku free tier rate limits.
After build: commit "feat: candidate shortlisting AI E5", push, deploy.
```

---

### PROMPT 5C — E6: WhatsApp Hire Flow

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Feature: WhatsApp Hire Flow (E6)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

Build one-click WhatsApp messaging from employer pipeline to candidates.

CHECK FIRST: Read existing Green API config in .env — use same GREEN_API_INSTANCE_ID
and GREEN_API_TOKEN. Check how ddotsmediajobs sends WhatsApp for reference pattern.

NO NEW MIGRATION — uses existing tables + interview_invites (from JS10).

BACKEND (tRPC):
- whatsapp.sendInterview — sends interview invite to seeker's WhatsApp
  Message template: "Dear [Name], [Company] has invited you for an interview
  for [Job Title]. Date: [Date], Mode: [Mode], [Location/Link].
  Reply YES to confirm or NO to decline. - ddotsjobs.com"
- whatsapp.sendOffer — sends offer congratulations
  Template: "Congratulations [Name]! [Company] is pleased to offer you
  [Job Title]. Please log in to ddotsjobs.com to view and respond to your offer."
- whatsapp.sendRejection — sends professional rejection
  Template: "Dear [Name], Thank you for applying to [Company] for [Job Title].
  We have shortlisted other candidates at this time. Best wishes - ddotsjobs.com"
- whatsapp.sendCustom — employer types custom message (250 char limit)
- All sends logged to a new table: whatsapp_logs
  (id, employer_id, seeker_id, job_id, type, message, sent_at, status)

EMPLOYER PIPELINE (update E1 side panel):
- WhatsApp action buttons:
  📅 "Send Interview Invite" → form: date, time, mode, location
  🎉 "Send Offer" → confirm dialog
  ❌ "Send Rejection" → confirm dialog
  💬 "Custom Message" → text input
- Show send status: sent ✓ / failed ✗
- WhatsApp log tab in pipeline shows all messages sent to a candidate

Validate: seeker must have phone number. Show warning if missing.
After build: commit "feat: whatsapp hire flow E6", push, deploy.
```

---

## PHASE 6 — Employer Revenue & Analytics (E7–E10)

### PROMPT 6A — E7: Job Boost / Sponsoring

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Feature: Job Boost / Sponsoring (E7)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

Build paid job featuring/boost system.

MIGRATION (additive only):
- Add to jobs table:
  - is_featured (bool default false)
  - featured_until (timestamptz nullable)
  - boost_tier (enum: 'none','standard','premium','elite') default 'none'

- Table: job_boosts
  - id, job_id (FK), employer_id (FK), tier (varchar), amount_paid (int),
    currency (varchar default 'INR'), started_at, expires_at,
    payment_ref (varchar nullable), status (enum: 'pending','active','expired'),
    created_at

BACKEND (tRPC):
- boost.getPlans — return static boost tiers:
  Standard: ₹499/7 days — Featured badge, priority in search
  Premium: ₹999/14 days — Featured + Homepage slot (1 of 5) + WhatsApp blast to 1 group
  Elite: ₹1999/30 days — All above + Top of category page + Social media post
- boost.create — create boost record with status=pending
- boost.activate — admin activates after payment confirmation (manual for now)
- boost.checkExpiry — BullMQ daily job to set is_featured=false when expired
- boost.getActive — employer sees active boosts + days remaining

PAGES:
/employer/jobs/[jobId]/boost:
- 3 tier cards with features checklist and pricing
- "Request Boost" → creates pending boost, shows payment instructions
  (UPI / Bank Transfer details — hardcode for now, Razorpay later)
- Active boost status banner

Admin /admin/boosts:
- Pending boosts table: employer, job, tier, payment ref
- "Activate" button → sets status=active, is_featured=true, sets featured_until

FRONTEND: Job cards and listings show Featured/Premium/Elite badge.
Homepage: featured jobs section shows up to 5 premium+ boosted jobs.
After build: commit "feat: job boost sponsoring E7", push, deploy.
```

---

### PROMPT 6B — E8: Team Hiring Accounts

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Feature: Team Hiring Accounts (E8)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

Build multi-user employer accounts with role permissions.

MIGRATION (additive only):
- Table: employer_team_members
  - id, employer_id (FK), user_id (FK users), role (enum: 'owner','admin','recruiter','viewer'),
    invited_by (FK users), invite_token (varchar nullable), invite_accepted_at (timestamptz nullable),
    is_active (bool default true), created_at

BACKEND (tRPC):
- team.invite — send email invite with token (Resend), create pending member record
- team.acceptInvite — validate token, create user account if needed, link to employer
- team.list — list team members with roles
- team.changeRole — owner/admin can change roles
- team.remove — deactivate member
- team.getPermissions — return what current user can do:
  owner: everything
  admin: post jobs, manage pipeline, view analytics, invite recruiters
  recruiter: manage pipeline, message candidates, cannot post jobs
  viewer: read-only, cannot message or move pipeline

MIDDLEWARE: update all employer tRPC routes to check team permissions via getPermissions.

PAGE: /employer/team
- Team members list: photo, name, email, role badge, joined date
- Invite button → email input + role selector
- Pending invites section with resend/cancel
- Role badges: Owner (crown), Admin (shield), Recruiter (person), Viewer (eye)
- Current user cannot remove themselves or change own role

Accept invite page: /employer/invite/[token]
- Shows company name + role being invited to
- "Accept & Join" → if no account, show registration form → auto-link

After build: commit "feat: team hiring accounts E8", push, deploy.
```

---

### PROMPT 6C — E9: Walk-in Drive Manager

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Feature: Walk-in Drive Manager (E9)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

Build walk-in interview event management.

CHECK FIRST: Does walk_in_date / walk_in_venue already exist in jobs table?
If yes, extend. If no, add additively.

MIGRATION (additive only):
- Table: walkin_events
  - id, employer_id, job_id (FK nullable), title, description,
    event_date (date), start_time (time), end_time (time),
    venue_name, venue_address, district, google_maps_link (nullable),
    positions_available (int), walk_in_for (text) -- roles being hired,
    requirements (text), bring_documents (text[]),
    registrations_count (int default 0),
    is_published (bool default false), created_at, updated_at

- Table: walkin_registrations
  - id, event_id (FK), seeker_id (FK), name, phone, email,
    experience_years (int nullable), current_role (varchar nullable),
    registration_code (varchar unique), attended (bool nullable),
    created_at

BACKEND (tRPC):
- walkin.create / update / publish — employer manages events
- walkin.list — public listing paginated, filter by district/date
- walkin.register — seeker registers, gets confirmation + unique code
- walkin.getRegistrations — employer sees attendee list, mark attended
- walkin.exportAttendees — CSV export

PAGES:
/walk-in-jobs (public):
- Upcoming walk-in drives listing, Kerala district filter
- Event card: company, date, time, venue, roles, slots remaining
- Click → event detail page with registration form

/employer/walkin:
- Create/edit walk-in events
- Published events with registration count
- Attendee management: list, search, mark attended, export

Notification: registered seekers get WhatsApp reminder 1 day before via BullMQ.
After build: commit "feat: walkin drive manager E9", push, deploy.
```

---

### PROMPT 6D — E10: Hiring Analytics Dashboard

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Feature: Hiring Analytics Dashboard (E10)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

Build comprehensive hiring analytics for employers.

NO NEW MIGRATION — queries existing tables.

BACKEND (tRPC — router: employerAnalytics.ts):
- analytics.overview — for date range:
  { totalJobsPosted, totalApplications, totalViews, avgTimeToHire,
    conversionRate (applies/views), hireRate (hired/applies) }
- analytics.funnelData — pipeline stage counts for all active jobs
- analytics.jobPerformance — per-job: views, applies, shortlisted, hired, cost_per_hire
- analytics.applicantSources — breakdown by: direct search, job alert, WhatsApp, referral
- analytics.districtBreakdown — applicants by Kerala district (map data)
- analytics.categoryTrends — applications by job category over time
- analytics.timeToHire — avg days from post to hire per job

PAGE: /employer/analytics
- Date range picker (last 7d / 30d / 90d / custom)
- KPI cards: Total Applies, Hire Rate, Avg Time to Hire, Profile Views
- Application funnel chart (recharts funnel/bar)
- Job performance table: sortable by views, applies, conversion
- Applicant source pie chart
- Kerala district heatmap (SVG map of Kerala districts colored by applicant density)
- Time series: applications per day (line chart)
- Export report as PDF button (html2canvas the dashboard)

Mobile: KPI cards stack, charts scroll horizontally.
After build: commit "feat: hiring analytics dashboard E10", push, deploy.
```

---

## PHASE 7 — AI Tools Expansion (AI1–AI5)

### PROMPT 7A — AI1: Mock Interview Simulator

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Feature: Mock Interview Simulator (AI1)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

Build a text-based AI mock interview with scoring feedback.

MIGRATION (additive only):
- Table: mock_interviews
  - id, user_id, job_title, company_type (startup/mnc/govt/ngo),
    experience_level (fresher/mid/senior), interview_type (hr/technical/managerial),
    questions (jsonb array), answers (jsonb array),
    scores (jsonb), overall_score (int nullable),
    feedback (text nullable), completed_at (timestamptz nullable), created_at

BACKEND (tRPC):
- mockInterview.start — generate 8 interview questions using callAI():
  System: "You are a Kerala HR interviewer for [company_type].
  Generate 8 interview questions for [job_title] at [experience_level] level.
  Mix: 2 introduction, 2 behavioral, 2 technical, 1 situational, 1 salary/availability.
  Return JSON array of {question, type, tips}."
- mockInterview.submitAnswer — store answer for a question
- mockInterview.evaluate — after all answers, callAI() scores each answer 1-10
  with specific feedback: {score, feedback, betterAnswer}
- mockInterview.getHistory — past sessions with scores

PAGE: /tools/mock-interview
- Setup form: job title, company type, experience level, interview type
- Interview screen:
  - Question displayed one at a time (1 of 8)
  - Text area for answer (min 50 chars to proceed)
  - Timer: 3 minutes per question (optional, toggleable)
  - Tips accordion below question
  - Progress bar
- Results screen:
  - Overall score with grade (A/B/C/D)
  - Per-question breakdown: your answer, score badge, AI feedback, better answer
  - Top 3 strengths + top 3 improvement areas
  - "Try Again" and "Practice Weak Areas" buttons
- History: past interviews with scores, date, role

After build: commit "feat: mock interview simulator AI1", push, deploy.
```

---

### PROMPT 7B — AI2 + AI3: Job Scam Detector v2 + Salary Intelligence

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Features: Job Scam Detector v2 (AI2) + Kerala Salary Intelligence (AI3)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

Build both AI tools in one phase (both are single-page stateless tools).

--- AI2: JOB SCAM DETECTOR v2 ---
ENHANCEMENT over existing fake job detector tool.
Add to existing tool at /tools/fake-job-detector:

New checks (via callAI with web context prompt):
1. Registration fee red flag detection (any mention of fees/deposit)
2. Unrealistic salary detection (>3x market rate for role)
3. Vague company description check
4. Too-good-to-be-true language patterns
5. Contact method analysis (only WhatsApp/Gmail = higher risk)
6. Kerala-specific scam patterns (fake Gulf visa agents, fake nursing abroad agents)

Return enhanced risk report:
{ riskScore: 0-100, riskLevel: low/medium/high/critical,
  redFlags: [{flag, severity, explanation}],
  greenFlags: [{flag}],
  verdict: string,
  recommendation: string }

UI: Add risk-o-meter gauge chart, red flag cards with severity badges,
"Report this job" button (logs to admin scam_reports table).

--- AI3: KERALA SALARY INTELLIGENCE ---
NEW PAGE: /tools/salary-intelligence

MIGRATION: Table salary_data (seed with static data):
- id, job_title, category, experience_min, experience_max,
  district (nullable), sector (private/govt/ngo/startup),
  salary_min, salary_max, salary_median, currency (INR),
  gulf_equivalent (int nullable), data_year (int default 2024),
  sample_size (int)

Seed 50 common Kerala roles across categories.

BACKEND:
- salary.getRange — query salary_data for role + experience + district
- salary.compare — callAI() for roles not in DB, using market context
- salary.getHeatmap — district-wise salary data for a role

PAGE /tools/salary-intelligence:
- Input: job title (autocomplete), experience years, district, sector
- Output:
  - Salary range bar: min / median / max with INR values
  - Gulf equivalent comparison (side by side)
  - District comparison: same role across 5 districts
  - "Is my offer fair?" input: paste offer → AI verdict
  - Trend insight: "Software developers in Kochi earn 23% more than state average"

After build: commit "feat: scam detector v2 + salary intelligence AI2-AI3", push, deploy.
```

---

### PROMPT 7C — AI4 + AI5: Career Switch Advisor + LinkedIn Optimizer

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Features: Career Switch Advisor (AI4) + LinkedIn Profile Optimizer (AI5)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

Build two single-session AI tools.

--- AI4: CAREER SWITCH ADVISOR ---
PAGE: /tools/career-switch

Input form:
- Current job title + years experience
- Current industry
- Target career (or "I don't know — suggest me options")
- Reason for switch (better salary / passion / stability / return from Gulf / etc.)

callAI() prompt: "You are a Kerala career counselor. Analyze this career switch request
and provide: 3 viable target careers with transferable skills, realistic timeline,
salary comparison (Kerala market), top 3 challenges and how to overcome them,
first 3 actionable steps. Consider Kerala job market, Gulf opportunities, and
government sector options. Return structured JSON."

Output UI:
- 3 career option cards: title, match %, salary range, transition timeline
- Transferable skills visual (tag cloud)
- Challenges accordion with solutions
- Action plan timeline (3 steps with checkboxes)
- "Find jobs in this field" CTA → links to job search

--- AI5: LINKEDIN PROFILE OPTIMIZER ---
PAGE: /tools/linkedin-optimizer

Input: textarea for pasting LinkedIn profile sections
(About, Headline, Experience descriptions)

Target market selector: Kerala Private / Gulf (UAE/Qatar/Saudi) / IT/Tech / Nursing Abroad

callAI() prompt: "Optimize this LinkedIn profile for [target_market].
Rewrite: headline (120 chars max), about section (300 words, Kerala/Gulf market focused),
improve each experience bullet for impact.
Return JSON: {headline, about, experience_bullets: [{original, improved}], keywords: []}"

Output UI:
- Side-by-side: original vs optimized
- Copy buttons for each section
- Keywords to add (skill tags)
- Completeness score before/after
- "Apply these to your ddotsjobs profile" button

After build: commit "feat: career switch + linkedin optimizer AI4-AI5", push, deploy.
```

---

## PHASE 8 — AI Tools Completion (AI6–AI10)

### PROMPT 8A — AI6 + AI7: Reference Letter Generator + Multilingual JD Translator

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Features: Reference Letter Generator (AI6) + Multilingual JD Translator (AI7)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

--- AI6: REFERENCE LETTER GENERATOR ---
PAGE: /tools/reference-letter

Form inputs:
- Your name, your role, years at company
- Company name, industry
- Referee name, referee designation, referee relationship to you
- Key achievements (3 text fields)
- Purpose: job application / visa / higher studies / professional

callAI(): Generate a formal reference letter in Kerala professional style.
3 templates: Formal Corporate, Academic, Gulf Visa Support.

Output:
- Full letter preview (printable layout)
- Edit any paragraph inline
- Download as PDF (html2canvas)
- Copy to clipboard
- Malayalam version toggle (translate via callAI())

--- AI7: MULTILINGUAL JD TRANSLATOR ---
PAGE: /tools/jd-translator

Paste job description → select target language → translate + adapt.

Language pairs: English → Malayalam, Malayalam → English,
English → Arabic, Arabic → English, Malayalam → Arabic.

callAI() prompt: "Translate this job description to [language].
Preserve all technical terms accurately. Use formal professional [language].
For Malayalam: use standard written Malayalam, not colloquial.
For Arabic: use Gulf professional Arabic appropriate for UAE/Qatar/Saudi job market."

Output:
- Side-by-side original + translated
- Copy translated text button
- "Post this job in Malayalam" → pre-fills job post form with translation
- "Download bilingual JD" → PDF with both languages side by side

Employer access: embed translator in /employer/jobs/new form as "Translate JD" button.
After build: commit "feat: reference letter + JD translator AI6-AI7", push, deploy.
```

---

### PROMPT 8B — AI8 + AI9: Skill Gap Heatmap + Offer Letter Analyzer

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Features: Skill Gap Heatmap (AI8) + Offer Letter Analyzer (AI9)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

--- AI8: SKILL GAP HEATMAP ---
PAGE: /tools/skill-gap-heatmap

Input: job seeker's current skills (multi-select from predefined list + custom add)
+ target category (dropdown of Kerala job categories)

Backend: query top 20 jobs in that category → extract required skills frequency
Then callAI() to analyze gaps + learning resources.

Output:
- Heatmap grid: skills on Y axis, demand level on X (recharts heatmap or custom SVG)
- Color: green = you have it, red = you lack it, orange = partial
- Top 5 missing skills with:
  - Demand percentage ("78% of jobs need this")
  - Free learning resource (YouTube/NPTEL/Kerala IT Mission link)
  - Time to learn estimate ("~2 weeks")
- "Add to career plan" saves gaps to career planner (JS4)

--- AI9: OFFER LETTER ANALYZER ---
PAGE: /tools/offer-analyzer

Input: paste offer letter text (or upload PDF — use pdf-parse)

callAI() analysis:
1. Extract: role, salary, joining date, notice period, probation, benefits
2. Compare salary to Kerala market benchmark (from salary_data table)
3. Flag red flags: no PF/ESI mention, no gratuity, too long probation, vague clauses
4. Flag green flags: good benefits, clear terms, reputed company signals
5. Rate offer: Poor / Fair / Good / Excellent with explanation
6. Negotiation suggestions if salary below market

Output:
- Extracted terms structured card
- Market comparison bar (your offer vs median vs top quartile)
- Red/Green flags with explanations
- AI verdict + negotiation script

After build: commit "feat: skill gap heatmap + offer analyzer AI8-AI9", push, deploy.
```

---

### PROMPT 8C — AI10: AI Career Counselor Chat

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Feature: AI Career Counselor Chat (AI10)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

Build a persistent AI career counselor chat for job seekers.

MIGRATION (additive only):
- Table: counselor_sessions
  - id, user_id, messages (jsonb array of {role, content, timestamp}),
    title (varchar nullable), created_at, updated_at

BACKEND (tRPC):
- counselor.getHistory — list user's past sessions (title, last message, date)
- counselor.getSession — full message history for a session
- counselor.chat — add message + call callAI() with full history context
  System prompt: "You are Thozhil AI, a Kerala career counselor on ddotsjobs.com.
  You specialize in: Kerala job market, PSC exams, Gulf opportunities, nursing abroad,
  IT career paths, government jobs, NORKA schemes for returnees.
  You speak in a warm, encouraging tone. You can respond in Malayalam if the user writes in Malayalam.
  You have knowledge of all 14 Kerala districts and their job markets.
  Keep responses concise (under 150 words unless asked for detail).
  Always suggest actionable next steps."
- counselor.newSession — create new session
- counselor.deleteSession — delete a session

PAGE: /tools/career-counselor
- Chat interface: WhatsApp-style bubbles, seeker messages right, AI left
- Sidebar (desktop): past sessions list, new chat button
- Mobile: bottom sheet for session history
- Suggested prompts on empty state:
  "How do I get a government job in Kerala?"
  "Is nursing abroad a good option for me?"
  "Help me prepare for LDC exam"
  "I'm a Gulf returnee, what are my options?"
- Typing indicator animation while AI responds (streaming via SSE or poll)
- Language toggle: English / Malayalam
- Sessions auto-titled from first message (callAI() generates title)

After build: commit "feat: AI career counselor chat AI10", push, deploy.
```

---

## PHASE 9 — Community & Engagement (C1–C5)

### PROMPT 9A — C1 + C2: Community Feed + Professional Groups

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Features: Community Feed (C1) + Professional Groups (C2)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

Build LinkedIn-style community feed with professional groups.

MIGRATION (additive only):
- Table: community_posts
  - id, user_id, group_id (FK nullable), content (text max 1000),
    post_type (enum: 'update','question','tip','success','job_tip','news'),
    image_url (varchar nullable), likes_count (int default 0),
    comments_count (int default 0), is_pinned (bool default false),
    is_approved (bool default true), created_at, updated_at

- Table: community_likes
  - id, post_id, user_id, created_at — UNIQUE(post_id, user_id)

- Table: community_comments
  - id, post_id, user_id, content (text max 500),
    parent_id (FK nullable for replies), created_at

- Table: professional_groups
  - id, name, slug, description, category (district/industry/profession),
    cover_image (varchar nullable), member_count (int default 0),
    is_active (bool default true), created_at

- Table: group_members
  - id, group_id, user_id, role (enum: member/moderator/admin),
    joined_at — UNIQUE(group_id, user_id)

Seed 10 starter groups: IT Kerala, Nurses Kerala, Teachers Kerala,
Gulf Returnees, Drivers Kerala, Accountants Kerala, Thrissur Jobs,
Kochi Jobs, Trivandrum Jobs, Women in Tech Kerala.

BACKEND (tRPC — router: community.ts):
- community.getFeed — paginated posts (global or group), newest first
- community.createPost — create post (content moderation: callAI() flag check)
- community.likePost — toggle like (optimistic)
- community.addComment — add comment/reply
- community.getGroups — list all groups with member count
- community.joinGroup / leaveGroup
- community.getGroupFeed — posts in a group

PAGES:
/community (public feed):
- Post composer: text + optional image upload + post type selector
- Feed cards: user avatar, name, role/district, post type badge,
  content, like/comment/share counts, comment preview
- Right sidebar: trending topics, suggested groups (desktop)

/community/groups:
- Group grid: cover image, name, member count, join button

/community/groups/[slug]:
- Group header, member count, Join/Leave button
- Group feed (same card component)

Content moderation: callAI() on post creation — flag if contains phone numbers,
external links, or abusive content → auto-hold for admin review.
After build: commit "feat: community feed + groups C1-C2", push, deploy.
```

---

### PROMPT 9B — C3 + C4: Success Stories + Mentorship Matching

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Features: Success Stories (C3) + Mentorship Matching (C4)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

--- C3: SUCCESS STORIES ---
MIGRATION (additive only):
- Table: success_stories
  - id, user_id, title, story (text), from_role, to_role,
    company_hired_at, time_to_get_job (varchar), district,
    category, photo_url (nullable), is_featured (bool default false),
    is_approved (bool default false), views (int default 0), created_at

BACKEND:
- story.submit — seeker submits story (status: pending admin approval)
- story.list — approved stories paginated, filter by category/district
- story.get — single story + increment views
- story.feature — admin can feature top stories

PAGES:
/success-stories (public):
- Hero: "Real people. Real jobs. Real Kerala stories."
- Featured story (large card) + grid of approved stories
- Filter: category, district, time period
- Each card: photo, from→to role, company, district, excerpt

/success-stories/[slug]:
- Full story page with SEO meta
- Share buttons (WhatsApp, Facebook)
- "Submit Your Story" CTA

/dashboard/submit-story:
- Form: title, story textarea, from/to role, company, district, photo upload
- Preview before submit
- Status: pending/approved/featured

--- C4: MENTORSHIP MATCHING ---
MIGRATION (additive only):
- Table: mentors
  - id, user_id, expertise (text[]), industry, years_experience,
    current_role, bio (text), availability (varchar),
    max_mentees (int default 3), current_mentees (int default 0),
    is_active (bool default true), district (nullable), created_at

- Table: mentorship_requests
  - id, mentee_id, mentor_id, message (text), goal (varchar),
    status (enum: pending/accepted/declined/completed),
    created_at, updated_at

BACKEND:
- mentor.apply — seeker applies to become mentor
- mentor.list — browse mentors, filter by industry/district
- mentor.requestMentorship — send request to mentor
- mentor.respond — mentor accepts/declines
- mentor.match — callAI() suggests best mentor matches for a seeker

PAGES:
/mentorship (public):
- "Find a Mentor / Become a Mentor" tabs
- Mentor cards: photo, role, expertise tags, district, availability, "Request" button
- Filter: industry, district, expertise
- Become a Mentor form (for logged-in users)

/dashboard/mentorship:
- My mentor (if matched) with contact options
- My mentee requests (if mentor)
- "Find my ideal mentor" → AI matching

After build: commit "feat: success stories + mentorship C3-C4", push, deploy.
```

---

### PROMPT 9C — C5 + C6: Weekly Job Digest + Skill Assessment Badges

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Features: Weekly Job Digest (C5) + Skill Assessment Badges (C6)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

--- C5: WEEKLY JOB DIGEST ---
MIGRATION (additive only):
- Table: digest_subscriptions
  - id, email (varchar), phone (varchar nullable), name (varchar),
    districts (text[] default '{}'), categories (text[] default '{}'),
    channel (enum array: email/whatsapp), frequency (enum: daily/weekly),
    is_active (bool default true), unsubscribe_token (varchar unique), created_at

- Table: digest_sends
  - id, subscription_id, sent_at, job_count, open_count (int default 0), created_at

BACKEND:
- digest.subscribe — public subscribe (no auth needed)
- digest.unsubscribe — via token in email link
- digest.sendWeekly — BullMQ job every Monday 8AM IST:
  For each active subscription: query top 10 matching jobs →
  build email HTML (Resend template) + WhatsApp message summary →
  send + log

/subscribe (public page):
- Simple form: name, email, phone (optional), district multi-select,
  category multi-select, channel preference
- "Subscribe for Free" button
- Confirmation: "Check your email/WhatsApp for this week's digest"

Admin /admin/digest:
- Subscription count by district/category
- Send digest manually button
- Last send stats

--- C6: SKILL ASSESSMENT BADGES ---
MIGRATION (additive only):
- Table: skill_assessments
  - id, skill_name, slug, description, questions (jsonb array),
    passing_score (int default 70), duration_minutes (int default 15),
    badge_color (varchar), badge_icon (varchar), created_at

- Table: skill_badges
  - id, user_id, assessment_id, score (int), attempts (int default 1),
    earned_at (timestamptz), expires_at (timestamptz nullable),
    is_verified (bool default true)
  - UNIQUE(user_id, assessment_id) — update on retry if better score

Seed 8 assessments: MS Excel Basic, Typing Speed (30wpm), English Communication,
Malayalam Typing, Basic Accounting, Customer Service, Data Entry, Computer Basics.

BACKEND:
- assessment.list — all available assessments with seeker's status
- assessment.start — return randomized questions (hide correct answers)
- assessment.submit — score, issue badge if passed, store result
- assessment.getMyBadges — seeker's earned badges
- assessment.generateCert — HTML certificate for download

PAGES:
/skills (public/auth):
- Assessment grid: skill name, duration, badge preview, pass rate
- "Take Test" → fullscreen timed test
- Results: pass/fail, score, badge earned (animation), retry option

/profile/[username]:
- Badges section showing earned verified badges with skill name + score

After build: commit "feat: weekly digest + skill badges C5-C6", push, deploy.
```

---

## PHASE 10 — Community Completion (C7–C10)

### PROMPT 10A — C7 + C8: Referral Network + Company Reviews

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Features: Referral Network (C7) + Company Reviews (C8)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

--- C7: REFERRAL NETWORK ---
MIGRATION (additive only):
- Add to seekers table:
  - referral_code (varchar unique) — generate on registration
  - referred_by (varchar nullable FK referral_code)
  - referral_points (int default 0)

- Table: referral_events
  - id, referrer_user_id, referred_user_id, event_type
    (enum: signup/first_apply/hired), points_awarded (int), created_at

- Table: referral_rewards
  - id, user_id, points (int), reward_type (varchar),
    status (enum: pending/claimed/paid), created_at

Points system:
- Referred user signs up: 10 points
- Referred user applies to first job: 25 points
- Referred user gets hired (employer marks hired): 100 points
Redemption: 500 points = ₹100 Amazon/UPI voucher (manual for now)

BACKEND:
- referral.getCode — seeker's unique referral link
- referral.getStats — total referred, points earned, pending rewards
- referral.track — called on signup if ref code present in URL
- referral.redeem — submit redemption request (admin fulfills manually)
- referral.getLeaderboard — top 10 referrers this month

PAGES:
/dashboard/referral:
- Referral link with copy button + WhatsApp share
- Stats: referred count, points, INR earned
- Leaderboard widget
- Redemption button (at 500+ points)
- How it works steps

--- C8: COMPANY REVIEWS ---
MIGRATION (additive only):
- Table: company_reviews
  - id, employer_id (FK), reviewer_id (FK seekers), is_anonymous (bool default true),
    overall_rating (int 1-5), work_life_balance (int 1-5),
    salary_benefits (int 1-5), job_security (int 1-5), management (int 1-5),
    pros (text), cons (text), advice_to_management (text nullable),
    employment_type (enum: fulltime/parttime/contract/intern/former),
    is_approved (bool default false), helpful_count (int default 0), created_at

BACKEND:
- review.submit — seeker submits review (pending approval)
- review.getByEmployer — approved reviews for a company with aggregated ratings
- review.markHelpful — toggle helpful vote
- review.getMyReviews — reviews submitted by current user

EMPLOYER PAGE update (/company/[slug] from E3):
- Add reviews section: star ratings breakdown + review cards
- Anonymous by default, shows employment type
- Employer can respond to reviews (1 response per review)

/dashboard/write-review:
- Select company (autocomplete)
- Rating sliders for 5 dimensions
- Pros/Cons/Advice textareas
- Anonymous toggle
- Employment type selector
- Submit → "Your review is under review and will appear within 24 hours"

After build: commit "feat: referral network + company reviews C7-C8", push, deploy.
```

---

### PROMPT 10B — C9 + C10: Events & Job Fairs + Gamification

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Features: Events & Job Fairs (C9) + Leaderboard & Gamification (C10)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

--- C9: EVENTS & JOB FAIRS ---
MIGRATION (additive only):
- Table: job_fair_events
  - id, title, slug, description, banner_image (nullable),
    event_date (date), start_time, end_time,
    mode (enum: virtual/physical/hybrid),
    venue (varchar nullable), virtual_link (varchar nullable),
    district (varchar nullable), organizer (varchar),
    participating_companies (jsonb array of {name, logo, roles: []}),
    registration_limit (int nullable), registrations_count (int default 0),
    is_published (bool default false), created_at

- Table: event_registrations
  - id, event_id, user_id, name, email, phone,
    registration_code (varchar unique),
    attended (bool nullable), created_at

BACKEND:
- events.list — published events, upcoming first
- events.get — single event with companies list
- events.register — seeker registers, get confirmation code
- events.getRegistrations — admin/organizer view

PAGES:
/events (public):
- Upcoming job fairs and events listing
- Filter: virtual/physical, district
- Event cards: banner, title, date, mode badge, companies preview logos, register button

/events/[slug]:
- Full event page: description, agenda, participating companies list with roles
- Registration form (name, email, phone)
- QR code confirmation after registration
- Add to calendar (.ics download)

Admin /admin/events: create/edit/publish events, view registrations, mark attended.

--- C10: LEADERBOARD & GAMIFICATION ---
MIGRATION (additive only):
- Table: user_points
  - id, user_id, total_points (int default 0),
    weekly_points (int default 0), monthly_points (int default 0),
    level (varchar default 'Beginner'), updated_at

- Table: point_events
  - id, user_id, points (int), reason (varchar), created_at

Points system (extend referral points):
- Profile 100% complete: 50 pts (once)
- First job application: 20 pts
- Skill badge earned: 30 pts each
- Resume uploaded/built: 25 pts
- Daily login: 2 pts (max 14/week)
- Community post: 10 pts (max 30/week)
- Comment on post: 3 pts (max 15/week)
- Job alert set up: 10 pts (once)
- Mentor matched: 40 pts

Levels: Beginner (0-99) → Explorer (100-299) → Seeker (300-599) →
Achiever (600-999) → Champion (1000-1999) → Legend (2000+)

BACKEND:
- points.award — called by other features to award points
- points.getLeaderboard — top 20 this week/month/alltime
- points.getMyRank — user's rank + points + level
- points.getHistory — last 20 point events

COMPONENTS:
- PointsBadge — shown in navbar: "⭐ 342 pts | Explorer"
- Leaderboard widget — /community sidebar + /leaderboard page
- Level progress bar — /dashboard sidebar

/leaderboard (public):
- Weekly / Monthly / All-time tabs
- Top 20 with avatar, name, district, level badge, points
- Current user's rank highlighted (even if outside top 20)

After build: commit "feat: events job fairs + gamification C9-C10", push, deploy.
```

---

## BONUS PHASE — Security & SEO Audit

### PROMPT B1 — Security Audit

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Task: Security Audit (Pre-launch)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

Perform a full security audit and fix all issues found.

AUDIT CHECKLIST — check and fix each:

1. ENV LEAKS
   - Verify .env is in .gitignore
   - No hardcoded secrets in source: grep -r "PGPASSWORD\|API_KEY\|SECRET" apps/web/src
   - Verify NEXTAUTH_SECRET is set and > 32 chars

2. AUTH SECURITY
   - All /dashboard/* routes require auth — check middleware.ts
   - All /employer/* routes require employer role
   - All /admin/* routes require admin role
   - tRPC procedures: verify protectedProcedure used for auth-required routes
   - Session expiry: set to 24h max

3. API RATE LIMITING
   - Check if rate limiting exists on tRPC or API routes
   - Add rate limit on: /api/auth (5 req/min), AI tool endpoints (10 req/min per user),
     job applications (3 per minute per user)
   - Use existing rate limit pattern from ddotsmediajobs or install upstash/ratelimit

4. INPUT VALIDATION
   - All tRPC inputs use Zod schemas — verify no raw user input reaches DB
   - File uploads: validate MIME type + size limit (5MB max, images only for photos)
   - SQL injection: Prisma/parameterized queries in use? Verify no raw SQL with user input

5. HEADERS & CSP
   - Add to next.config.ts headers:
     X-Frame-Options: DENY
     X-Content-Type-Options: nosniff
     Referrer-Policy: strict-origin-when-cross-origin
     Permissions-Policy: camera=(), microphone=(), geolocation=()

6. ADMIN PROTECTION
   - /admin-login: add brute force protection (5 failed attempts → 15min lockout)
   - Store lockout in Redis (check if Redis available at port 6379)

7. DATA EXPOSURE
   - Seeker phone numbers: never expose in public API responses
   - employer email: only visible to admin and own employer account
   - Verify job seeker CV URLs are not publicly guessable (add UUID to filename)

8. DEPENDENCIES
   - Run: pnpm audit (report critical/high vulnerabilities)
   - Fix any critical issues

Report all findings and fixes made. Commit "security: pre-launch audit fixes", push, deploy.
```

---

### PROMPT B2 — SEO Audit

```
Session rules: no pnpm db:seed, additive migrations only, never touch other VPS projects,
rm -rf apps/web/.next before every VPS build, mobile-first, TypeScript strict,
Haiku default AI, one feature per prompt, deploy via bash /opt/ddotsjobs/run-deploy.sh.

Task: SEO Audit & Fixes (Pre-launch)
VPS: 194.164.151.202 | /opt/ddotsjobs | Port: 3107 | PG port: 5436

Perform full SEO audit and implement fixes.

AUDIT & FIX CHECKLIST:

1. META TAGS
   - Homepage: unique title + description mentioning Kerala jobs
   - Job detail page: dynamic title = "[Job Title] at [Company] | [District] | ddotsjobs.com"
   - Job detail description: first 160 chars of job description
   - Hub pages (cooperative/healthcare/women/etc.): unique meta per hub
   - OG tags: og:title, og:description, og:image for job cards

2. STRUCTURED DATA (JSON-LD)
   - Job posting schema on each job detail page:
     @type: JobPosting, title, description, datePosted, validThrough,
     employmentType, hiringOrganization, jobLocation, baseSalary
   - Organization schema on homepage
   - BreadcrumbList on hub pages and job listing pages

3. SITEMAP
   - Verify /sitemap.xml exists and is auto-generated
   - Must include: all job pages, all hub pages, company pages, static pages
   - Submit to Google Search Console (provide instructions, not automated)
   - Regenerate sitemap on new job post (revalidate)

4. ROBOTS.TXT
   - Verify /robots.txt exists
   - Block: /admin*, /dashboard*, /employer/*, /api/*
   - Allow: /jobs/*, /company/*, /hub/*, /tools/*, /psc-prep, /gulf-returnee

5. CORE WEB VITALS
   - Check for unoptimized images: all <img> tags should use next/image with sizes prop
   - Check for missing loading="lazy" on below-fold images
   - Remove unused CSS/JS imports in heavy pages

6. KERALA-SPECIFIC SEO
   - Hub page titles: "Cooperative Jobs in Kerala 2024", "Healthcare Jobs Kerala", etc.
   - Add FAQ schema to hub pages (3 common questions each)
   - District pages: if not exist, create /jobs/[district] pages for all 14 districts
     with unique H1, meta, and filtered job listings
   - Malayalam keywords in meta (secondary language meta tags)

7. INTERNAL LINKING
   - Job detail page: "More jobs in [Category]" + "More jobs in [District]" links
   - Hub pages: cross-link to related hubs
   - Homepage: links to all 14 district pages + top 8 categories

8. PAGE SPEED
   - Verify next.config.ts has images.domains for external image hosts
   - Check if any pages fetch unnecessary data on server (move to client if not SEO-critical)

Report all findings and fixes. Commit "seo: pre-launch audit fixes", push, deploy.
```

---

## EXECUTION ORDER SUMMARY

```
Phase 1:  JS1 → JS2 → JS3          (Resume Builder, Job Alerts, App Tracker)
Phase 2:  JS4 → JS5 → JS6          (Career Planner, Salary Coach, Gulf Returnee)
Phase 3:  JS7 → JS8 → JS9 → JS10   (PSC, Profile Meter, Saved Jobs, Interviews)
Phase 4:  E1 → E2 → E3             (Pipeline CRM, Bulk Import, Branding)
Phase 5:  E4 → E5 → E6             (Screening, AI Shortlist, WhatsApp Flow)
Phase 6:  E7 → E8 → E9 → E10       (Boost, Team Accounts, Walk-in, Analytics)
Phase 7:  AI1 → AI2+AI3 → AI4+AI5  (Mock Interview, Scam+Salary, Switch+LinkedIn)
Phase 8:  AI6+AI7 → AI8+AI9 → AI10 (Reference+Translate, Gap+Offer, Counselor)
Phase 9:  C1+C2 → C3+C4 → C5+C6   (Feed+Groups, Stories+Mentorship, Digest+Badges)
Phase 10: C7+C8 → C9+C10           (Referral+Reviews, Events+Gamification)
Bonus:    B1 → B2                   (Security Audit, SEO Audit)

Total: 10 phases, 40 features + 2 audits = 42 build prompts
Estimated timeline: ~6-8 weeks building 1 feature/day
```
