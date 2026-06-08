import { useQuery } from "@tanstack/react-query";

export type NwsAlert = {
  id: string;
  event: string;
  severity: string;
  headline: string;
  area: string;
  geometry: any; // GeoJSON
};

const SEVERITY_COLOR: Record<string, string> = {
  Extreme: "#dc2626",
  Severe: "#ef4444",
  Moderate: "#f59e0b",
  Minor: "#facc15",
  Unknown: "#9ca3af",
};

export function nwsSeverityColor(sev: string) {
  return SEVERITY_COLOR[sev] ?? "#f59e0b";
}

export function useNwsAlerts(area = "FL", enabled = true) {
  return useQuery({
    queryKey: ["nws-alerts", area],
    enabled,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    queryFn: async (): Promise<NwsAlert[]> => {
      const res = await fetch(`https://api.weather.gov/alerts/active?area=${area}`, {
        headers: { Accept: "application/geo+json" },
      });
      if (!res.ok) throw new Error("NWS fetch failed");
      const json = await res.json();
      return (json.features ?? [])
        .filter((f: any) => f.geometry)
        .map((f: any) => ({
          id: f.id,
          event: f.properties?.event ?? "Alert",
          severity: f.properties?.severity ?? "Unknown",
          headline: f.properties?.headline ?? "",
          area: f.properties?.areaDesc ?? "",
          geometry: f.geometry,
        }));
    },
  });
}
