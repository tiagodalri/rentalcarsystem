import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { NewBookingDialog } from "@/components/admin/NewBookingDialog";

export default function AdminBookingNew() {
  const navigate = useNavigate();
  const back = () => navigate("/admin/bookings");

  return (
    <div className="space-y-4">
      <button
        onClick={back}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={14} /> Voltar para Reservas
      </button>

      <NewBookingDialog
        mode="page"
        onCreated={back}
        onCancel={back}
      />
    </div>
  );
}
