import { Globe } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Language, languageLabels, languageFlags } from "@/i18n/translations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const languages: Language[] = ["pt", "en", "es", "it", "de", "fr"];

interface Props {
  size?: number;
  className?: string;
}

const LanguageSwitcher = ({ size = 16, className = "" }: Props) => {
  const { language, setLanguage } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors duration-300 outline-none ${className}`}
      >
        <Globe size={size} />
        <span className="text-xs font-medium uppercase tracking-wider">{languageFlags[language]}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-background/95 backdrop-blur-xl border-border/40 z-50">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang}
            onClick={() => setLanguage(lang)}
            className={`cursor-pointer gap-2 ${language === lang ? "text-primary font-semibold" : ""}`}
          >
            <span>{languageFlags[lang]}</span>
            <span>{languageLabels[lang]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitcher;
