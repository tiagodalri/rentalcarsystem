import { useLocation } from "react-router-dom";

const TITLE_MAP: Array<[RegExp, string]> = [
  [/^\/admin\/?$/, "Painel"],
  [/^\/admin\/ops-today/, "Operação"],
  [/^\/admin\/live/, "Live"],
  [/^\/admin\/bookings\/new/, "Nova Reserva"],
  [/^\/admin\/bookings\/[^/]+/, "Reserva"],
  [/^\/admin\/bookings/, "Reservas"],
  [/^\/admin\/calendar/, "Agenda"],
  [/^\/admin\/fleet\/new/, "Novo Veículo"],
  [/^\/admin\/fleet\/[^/]+/, "Veículo"],
  [/^\/admin\/fleet/, "Frota"],
  [/^\/admin\/customers\/new/, "Novo Cliente"],
  [/^\/admin\/customers\/[^/]+/, "Cliente"],
  [/^\/admin\/customers/, "Clientes"],
  [/^\/admin\/finance/, "Financeiro"],
  [/^\/admin\/report/, "Relatórios"],
  [/^\/admin\/team/, "Equipe"],
  [/^\/admin\/settings/, "Configurações"],
  [/^\/admin\/inspection/, "Inspeção"],
];

export function useAdminPageTitle() {
  const { pathname } = useLocation();
  for (const [re, title] of TITLE_MAP) {
    if (re.test(pathname)) return title;
  }
  return "Admin";
}
