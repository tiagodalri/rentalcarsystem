import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import AboutSection from "@/components/AboutSection";
import FleetSection from "@/components/FleetSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import DealsSection from "@/components/DealsSection";
import RequirementsSection from "@/components/RequirementsSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import Footer from "@/components/Footer";
import WhatsAppBubble from "@/components/WhatsAppBubble";

const Index = () => (
  <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
    <Navbar />
    <HeroSection />
    <AboutSection />
    <FleetSection />
    <HowItWorksSection />
    <DealsSection />
    <RequirementsSection />
    <TestimonialsSection />
    <Footer />
    <WhatsAppBubble />
  </div>
);

export default Index;
