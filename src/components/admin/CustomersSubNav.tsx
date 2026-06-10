import { NavLink } from "react-router-dom";
import { Users, Cake } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/admin/customers", label: "Todos os clientes", icon: Users, end: true },
  { to: "/admin/customers/birthdays", label: "Aniversariantes", icon: Cake, end: false },
];

export function CustomersSubNav() {
  return (
    <div className="border-b border-border/30 -mx-3 lg:-mx-6 px-3 lg:px-6 mb-4 lg:mb-6 overflow-x-auto scrollbar-none">
      <nav className="flex items-center gap-1 min-w-max" aria-label="Submenu de clientes">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                cn(
                  "relative inline-flex items-center gap-2 px-3 lg:px-4 h-10 text-[12px] lg:text-[12.5px] font-medium transition-colors whitespace-nowrap",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground/70 hover:text-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={14} strokeWidth={isActive ? 2.2 : 1.8} />
                  <span>{it.label}</span>
                  <span
                    className={cn(
                      "absolute left-2 right-2 -bottom-px h-[2px] rounded-full transition-all",
                      isActive ? "bg-primary opacity-100" : "opacity-0"
                    )}
                  />
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
