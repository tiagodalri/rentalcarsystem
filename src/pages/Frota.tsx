import Navbar from "@/components/Navbar";
import FleetSection from "@/components/FleetSection";
import Footer from "@/components/Footer";
import WhatsAppBubble from "@/components/WhatsAppBubble";

const Frota = () => (
  <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
    <Navbar />
    <main className="pt-24">
      <FleetSection />
    </main>
    <Footer />
    <WhatsAppBubble />
  </div>
);

export default Frota;
