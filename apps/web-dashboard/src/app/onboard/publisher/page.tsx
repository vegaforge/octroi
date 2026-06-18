import type { Metadata } from 'next';
import { SiteFooter } from '@/components/ui/SiteFooter';
import { SiteNav } from '@/components/ui/SiteNav';
import { PublisherOnboarding } from '@/components/onboard/PublisherOnboarding';

export const metadata: Metadata = {
  title: 'Open a publisher — Octroi',
  description:
    'Three minutes from "I have a website" to "AI crawlers are paying me per fetch". Add a Stellar payout address, pick a price, paste three lines.',
};

export default function PublisherOnboardingPage() {
  return (
    <>
      <SiteNav />
      <main className="min-h-[calc(100vh-var(--nav-h))]">
        <PublisherOnboarding />
      </main>
      <SiteFooter />
    </>
  );
}
