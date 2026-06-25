import { useAdminAuth } from "./useAdminAuth";

/**
 * Returns true when the current user is restricted from seeing any
 * financial value (prices, totals, deposits, franchise, revenue, etc.).
 *
 * Currently: street operators (driver role only, no other roles) must
 * never see financial data.
 */
export function useHideFinancials(): boolean {
  const { roles, loading } = useAdminAuth();
  if (loading) return false;
  if (roles.length === 0) return false;
  // Driver-only users (no other elevated role) cannot see financials.
  return roles.every((r) => r === "driver");
}
