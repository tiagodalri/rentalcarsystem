import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateContractPdf } from "@/utils/contractPdf";

interface ContractButtonProps {
  bookingId: string;
}

const ContractButton = ({ bookingId }: ContractButtonProps) => {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const { data: booking, error: bErr } = await supabase
        .from("bookings")
        .select("id, booking_number, status, pickup_date, return_date, pickup_time, return_time, pickup_location, return_location, total_price, addons, extra_driver, customer_id, vehicle_id, deposit_amount, franchise_amount")
        .eq("id", bookingId)
        .maybeSingle();

      if (bErr || !booking) {
        toast.error("Não foi possível carregar a reserva.");
        return;
      }

      const [{ data: customer }, { data: vehicle }] = await Promise.all([
        supabase
          .from("customers")
          .select("full_name, email, phone, document_number, driver_license, driver_license_expiry, nationality, address, house_number, complement, zip_code")
          .eq("id", booking.customer_id!)
          .maybeSingle(),
        supabase
          .from("vehicles")
          .select("name, category, license_plate, year, color, current_odometer, daily_price_usd")
          .eq("id", booking.vehicle_id)
          .maybeSingle(),
      ]);

      if (!customer || !vehicle) {
        toast.error("Dados de cliente ou veículo indisponíveis.");
        return;
      }

      generateContractPdf(booking as any, customer as any, vehicle as any);
      toast.success("Contrato gerado com sucesso.");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar o contrato.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title="Disponível após confirmação da reserva"
      className="w-full flex items-center justify-center gap-2 gold-gradient text-primary-foreground px-4 py-3 rounded-lg text-sm font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50"
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
      {loading ? "Gerando..." : "Baixar contrato"}
    </button>
  );
};

export default ContractButton;
