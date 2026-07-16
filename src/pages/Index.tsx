import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import AboutSection from "@/components/AboutSection";
import FleetSection from "@/components/FleetSection";

import RequirementsSection from "@/components/RequirementsSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import Footer from "@/components/Footer";
import WhatsAppBubble from "@/components/WhatsAppBubble";
import Seo from "@/components/Seo";

const Index = () => (
  <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
    <Seo
      title="GoDrive. Aluguel Premium em Orlando"
      description="Locadora de carros premium para brasileiros em Orlando. Corvette, Mustang, Escalade, BMW X5 e mais. Atendimento 100% em português."
      path="/"
    />
    <Navbar />
    <HeroSection />
    <AboutSection />
    <FleetSection />
    <RequirementsSection />
    <TestimonialsSection />
    <Footer />
    <WhatsAppBubble />
  </div>
);

export default Index;
