import Navbar from '@/components/landing/Navbar';
import Hero from '@/components/landing/Hero';
import Features from '@/components/landing/Features';
import HowItWorks from '@/components/landing/HowItWorks';
import Agents from '@/components/landing/Agents';
import Pricing from '@/components/landing/Pricing';
import TrustStrip from '@/components/landing/TrustStrip';
import FinalCta from '@/components/landing/FinalCta';
import Footer from '@/components/landing/Footer';

export default function Home() {
  return (
    <>
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Agents />
      <Pricing />
      <TrustStrip />
      <FinalCta />
      <Footer />
    </>
  );
}
