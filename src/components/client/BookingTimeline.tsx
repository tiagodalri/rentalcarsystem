import { motion } from "framer-motion";
import { BookingStatus } from "@/data/bookingTypes";
import { Check } from "lucide-react";

interface Step {
  label: string;
  key: string;
}

const steps: Step[] = [
  { label: "Reservado", key: "reserved" },
  { label: "Confirmado", key: "confirmed" },
  { label: "Retirada", key: "pickup" },
  { label: "Em uso", key: "in_use" },
  { label: "Devolução", key: "dropoff" },
  { label: "Concluído", key: "completed" },
];

const statusToStep: Record<BookingStatus, number> = {
  pending: 0,
  confirmed: 1,
  in_progress: 3,
  active: 3,
  completed: 5,
  cancelled: -1,
};

interface BookingTimelineProps {
  status: BookingStatus;
  pickupDate: string;
  dropoffDate: string;
}

const BookingTimeline = ({ status, pickupDate, dropoffDate }: BookingTimelineProps) => {
  const currentStep = statusToStep[status];
  const pickFormatted = new Date(pickupDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const dropFormatted = new Date(dropoffDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

  const dateMap: Record<number, string> = {
    2: pickFormatted,
    4: dropFormatted,
  };

  return (
    <div className="w-full overflow-x-auto py-4">
      <div className="flex items-start justify-between min-w-[500px] relative px-2">
        {/* line */}
        <div className="absolute top-4 left-6 right-6 h-0.5 bg-border/40" />
        <motion.div
          className="absolute top-4 left-6 h-0.5 gold-gradient"
          initial={{ width: 0 }}
          animate={{
            width: currentStep >= 0 ? `${(currentStep / (steps.length - 1)) * 100}%` : 0,
          }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{ maxWidth: "calc(100% - 48px)" }}
        />
        {steps.map((step, i) => {
          const done = i <= currentStep;
          const active = i === currentStep;
          return (
            <div key={step.key} className="flex flex-col items-center z-10 relative" style={{ flex: 1 }}>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.1, duration: 0.3 }}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                  done
                    ? "gold-gradient text-primary-foreground border-transparent"
                    : "bg-background border-border/50 text-muted-foreground"
                } ${active ? "ring-2 ring-primary/30 ring-offset-2 ring-offset-background" : ""}`}
              >
                {done ? <Check size={14} /> : i + 1}
              </motion.div>
              <span
                className={`text-[10px] mt-2 text-center leading-tight ${
                  done ? "text-foreground font-medium" : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
              {dateMap[i] && (
                <span className="text-[9px] text-muted-foreground/60 mt-0.5">{dateMap[i]}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BookingTimeline;
