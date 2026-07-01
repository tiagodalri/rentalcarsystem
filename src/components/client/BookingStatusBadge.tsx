import { BookingStatus, statusConfig } from "@/data/bookingTypes";
import { useAccountT } from "@/i18n/accountTranslations";

interface BookingStatusBadgeProps {
  status: BookingStatus;
  pulse?: boolean;
}

const BookingStatusBadge = ({ status, pulse }: BookingStatusBadgeProps) => {
  const config = statusConfig[status];
  const { t } = useAccountT();

  const labelMap: Record<BookingStatus, string> = {
    active: t.statusActive,
    in_progress: t.statusInProgress,
    confirmed: t.statusConfirmed,
    pending: t.statusPending,
    completed: t.statusCompleted,
    cancelled: t.statusCancelled,
  };

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider"
      style={{ color: config.color, backgroundColor: config.bgColor }}
    >
      {pulse && status === "active" && (
        <span className="relative flex h-2 w-2">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: config.color }}
          />
          <span
            className="relative inline-flex rounded-full h-2 w-2"
            style={{ backgroundColor: config.color }}
          />
        </span>
      )}
      {labelMap[status]}
    </span>
  );
};

export default BookingStatusBadge;
