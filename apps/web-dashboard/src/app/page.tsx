import { SiteNav } from '@/components/ui/SiteNav';
import { SiteFooter } from '@/components/ui/SiteFooter';
import { Hero } from '@/components/landing/Hero';
import { ProblemFix } from '@/components/landing/ProblemFix';
import { ForPublishers } from '@/components/landing/ForPublishers';
import { ForCrawlers } from '@/components/landing/ForCrawlers';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Pricing } from '@/components/landing/Pricing';
import { DemoStrip } from '@/components/landing/DemoStrip';

/** Landing page. Sections render top to bottom in the order below. */
export default function LandingPage() {
  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <ProblemFix />
        <ForPublishers />
        <ForCrawlers />
        <HowItWorks />
        <Pricing />
        <DemoStrip />
      </main>
      <SiteFooter />
    </>
  );
}
