import { pgEnum } from 'drizzle-orm/pg-core';

// ── Identity / roles ─────────────────────────────────
export const userRole = pgEnum('user_role', [
  'seeker',
  'employer',
  'admin',
  'moderator',
]);

export const employerType = pgEnum('employer_type', [
  'direct',
  'consultancy',
  'gulf_agency',
  'government',
  'staffing',
]);

// ── Jobs ─────────────────────────────────────────────
export const jobType = pgEnum('job_type', [
  'full_time',
  'part_time',
  'contract',
  'walk_in',
  'gulf',
  'internship',
  'temporary',
]);

export const jobStatus = pgEnum('job_status', [
  'draft',
  'pending_review',
  'active',
  'paused',
  'filled',
  'expired',
  'rejected',
]);

export const applicationStatus = pgEnum('application_status', [
  'applied',
  'viewed',
  'shortlisted',
  'interview',
  'offered',
  'hired',
  'rejected',
  'withdrawn',
]);

export const verificationStatus = pgEnum('verification_status', [
  'unverified',
  'pending',
  'verified',
  'rejected',
]);

export const professionalRegistrationType = pgEnum('professional_registration_type', [
  'nurses_council',
  'medical_council',
  'pharmacy_council',
  'bar_council',
  'engineering_board',
  'teaching_eligibility',
  'iti_ncvt',
  'other',
]);

// ── Alerts ───────────────────────────────────────────
export const alertChannel = pgEnum('alert_channel', [
  'whatsapp',
  'email',
  'push',
  'sms',
]);

export const alertFrequency = pgEnum('alert_frequency', [
  'instant',
  'daily',
  'weekly',
]);

// ── Payments / subscriptions ─────────────────────────
export const paymentStatus = pgEnum('payment_status', [
  'created',
  'authorized',
  'captured',
  'failed',
  'refunded',
  'partially_refunded',
]);

export const subscriptionTier = pgEnum('subscription_tier', [
  'free',
  'seeker_plus',
  'employer_basic',
  'employer_pro',
  'employer_enterprise',
]);

// ── Geography ────────────────────────────────────────
export const district = pgEnum('district', [
  'thiruvananthapuram',
  'kollam',
  'pathanamthitta',
  'alappuzha',
  'kottayam',
  'idukki',
  'ernakulam',
  'thrissur',
  'palakkad',
  'malappuram',
  'kozhikode',
  'wayanad',
  'kannur',
  'kasaragod',
]);

export const gulfCountry = pgEnum('gulf_country', [
  'uae',
  'saudi_arabia',
  'qatar',
  'kuwait',
  'oman',
  'bahrain',
]);

export const itPark = pgEnum('it_park', [
  'technopark',
  'infopark',
  'cyberpark',
  'kinfra',
  'ust_global_campus',
  'other',
]);

// ── Misc ─────────────────────────────────────────────
export const visibilityLevel = pgEnum('visibility_level', [
  'public',
  'registered',
  'verified_only',
  'private',
]);

export const contentLanguage = pgEnum('content_language', ['ml', 'en']);
