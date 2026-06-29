import type { Metadata } from 'next';
import { Hub, HubSection, Cards, Card, Bullets, CtaLink } from '@/components/hub/HubShell';

export const revalidate = 120;
export const metadata: Metadata = {
  title: 'Ayurveda & Wellness Jobs Kerala 2026 — BAMS, Therapist, Panchakarma | ddotsjobs.com',
  description:
    'Ayurveda & wellness jobs in Kerala — BAMS doctor, Panchakarma therapist, yoga instructor, naturopathy, wellness centre manager. Kerala is the home of Ayurveda.',
  alternates: { canonical: 'https://ddotsjobs.com/ayurveda-jobs' },
};

export default function AyurvedaJobsPage() {
  return (
    <Hub
      kicker="Ayurveda & wellness"
      title="Ayurveda & Wellness Jobs Kerala"
      titleMl="കേരളത്തിലെ Ayurveda ജോലികൾ"
      sub="Kerala is the home of Ayurveda. Find verified roles across hospitals, resorts, and wellness centres — from BAMS doctors to Panchakarma therapists."
    >
      <HubSection title="Roles">
        <Cards>
          <Card title="BAMS Doctor" href="/jobs?category=ayurveda">Ayurveda physician (Council registered)</Card>
          <Card title="Ayurveda Therapist / Masseur">Abhyanga & treatment delivery</Card>
          <Card title="Panchakarma Technician">Certified Panchakarma procedures</Card>
          <Card title="Yoga Instructor">Therapeutic & wellness yoga</Card>
          <Card title="Naturopathy Doctor">BNYS practitioners</Card>
          <Card title="Wellness Centre Manager">Operations + guest experience</Card>
          <Card title="Ayurveda Pharmacist">Dispensing & formulations</Card>
          <Card title="Medical Transcriptionist">Ayurveda documentation</Card>
        </Cards>
      </HubSection>

      <HubSection title="Licence & certification">
        <Bullets
          items={[
            'BAMS doctors must be registered with the Kerala Ayurveda Council / CCIM.',
            'Therapists benefit from a recognised Panchakarma certification.',
            'Naturopathy roles require BNYS qualification.',
          ]}
        />
      </HubSection>

      <HubSection title="Where Ayurveda hires in Kerala">
        <p style={{ color: '#3a3a34', fontSize: 15, lineHeight: 1.7 }}>
          Ayurveda hospitals, classical resorts, and wellness chains across Thiruvananthapuram, Kottayam, Thrissur, and Kozhikode hire year-round — including reputed institutions and treatment centres statewide.
        </p>
        <CtaLink href="/jobs?category=ayurveda">Browse Ayurveda jobs →</CtaLink>
      </HubSection>

      <HubSection title="Find Ayurveda clinics near you">
        <p style={{ color: '#3a3a34', fontSize: 15, lineHeight: 1.7 }}>
          Looking for Ayurveda clinics and practitioners across Kerala? Visit AyurConnect, a Ddotsmedia Technologies product.
        </p>
        <CtaLink href="https://ayurconnect.com">Explore AyurConnect →</CtaLink>
      </HubSection>
    </Hub>
  );
}
