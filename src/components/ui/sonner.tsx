import { useThemeMode } from "@/i18n/ThemeContext";
import { Toaster as Sonner, toast } from "sonner";
import { useEffect, useState } from "react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Wave 2 (UX mobile premium):
 *  - No mobile, toast aparece no bottom-center, dentro do safe-area
 *    (não cobre o que o usuário está olhando, não fica embaixo do dedo).
 *  - No desktop, mantém top-right padrão.
 *  - Offset respeita iPhone home indicator via env(safe-area-inset-bottom).
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useThemeMode();
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window === "undefined" ? false : window.innerWidth < 768,
  );

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position={isMobile ? "bottom-center" : "top-right"}
      offset={isMobile ? "calc(env(safe-area-inset-bottom, 0px) + 80px)" : 16}
      mobileOffset="calc(env(safe-area-inset-bottom, 0px) + 80px)"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
