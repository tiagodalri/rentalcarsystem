import { LogOut } from "lucide-react";
import { AuthUser } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useAccountT } from "@/i18n/accountTranslations";

interface ClientHeaderProps {
  user: AuthUser;
  onLogout: () => void;
}

const ClientHeader = ({ user, onLogout }: ClientHeaderProps) => {
  const { t } = useAccountT();
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6"
    >
      <div className="w-16 h-16 rounded-full gold-gradient flex items-center justify-center text-primary-foreground text-xl font-bold shrink-0">
        {initials}
      </div>
      <div className="flex-1 text-center sm:text-left">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          {t.greeting(user.name.split(" ")[0])}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{user.email}</p>
        <p className="text-muted-foreground/70 text-xs mt-1">
          {t.subtitle}
        </p>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <LanguageSwitcher />
        <button
          onClick={onLogout}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-destructive transition-colors uppercase tracking-wider"
        >
          <LogOut size={14} />
          {t.logout}
        </button>
      </div>
    </motion.div>
  );
};

export default ClientHeader;
