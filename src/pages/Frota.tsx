import Navbar from "@/components/Navbar";
import FleetSection from "@/components/FleetSection";
import Footer from "@/components/Footer";
import WhatsAppBubble from "@/components/WhatsAppBubble";
import Seo from "@/components/Seo";

const Frota = () => (
  <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
    <Seo
      title="Frota Premium em Orlando | Sua Marca"
      description="Conheça a frota Sua Marca em Orlando: SUVs, sedans e esportivos como Corvette, Mustang, Escalade, BMW X5, Tiguan e mais. Atendimento 100% em português."
      path="/frota"
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Frota Sua Marca em Orlando",
        url: "https://rentalcarsystem.lovable.app/frota",
        about: "Aluguel de carros premium em Orlando para brasileiros",
      }}
    />
    <Navbar />
    <main className="pt-24">
      <h1 className="sr-only">Nossa Frota de Veículos Premium em Orlando</h1>
      <FleetSection />
    </main>
    <Footer />
    <WhatsAppBubble />
  </div>
);

export default Frota;
