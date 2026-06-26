import { describe, it, expect } from "vitest";
import { resolvedPriceForDate, type PriceSeason, type PriceOverride, type PricingRules } from "@/lib/pricing";

const baseRules: PricingRules = {
  vehicle_id: "v1",
  weekend_multiplier: 1.25,
  weekly_discount_pct: 10,
  monthly_discount_pct: 20,
  min_nights: 1,
  weekend_days: [5, 6], // Fri, Sat
};

const seasonHigh: PriceSeason = {
  id: "s1", vehicle_id: "v1", name: "Holiday",
  start_date: "2026-12-20", end_date: "2027-01-05",
  price_usd: 400, priority: 10,
};

const seasonLow: PriceSeason = {
  id: "s2", vehicle_id: "v1", name: "WinterBroad",
  start_date: "2026-12-01", end_date: "2027-02-28",
  price_usd: 250, priority: 1,
};

const override: PriceOverride = {
  id: "o1", vehicle_id: "v1", date: "2026-12-25",
  price_usd: 999, note: "Xmas",
};

describe("resolvedPriceForDate", () => {
  it("returns base price on a weekday with no season/override", () => {
    const r = resolvedPriceForDate(new Date("2026-06-15T12:00:00Z"), 100, [], [], baseRules);
    expect(r.source).toBe("base");
    expect(r.weekend).toBe(false);
    expect(r.price).toBe(100);
  });

  it("applies weekend multiplier on Friday/Saturday", () => {
    // 2026-06-19 is Friday
    const r = resolvedPriceForDate(new Date("2026-06-19T12:00:00Z"), 100, [], [], baseRules);
    expect(r.weekend).toBe(true);
    expect(r.price).toBe(125);
  });

  it("does not apply weekend multiplier on Sunday by default", () => {
    const r = resolvedPriceForDate(new Date("2026-06-21T12:00:00Z"), 100, [], [], baseRules);
    expect(r.weekend).toBe(false);
    expect(r.price).toBe(100);
  });

  it("picks higher-priority season over lower one", () => {
    const r = resolvedPriceForDate(new Date("2026-12-22T12:00:00Z"), 100, [seasonLow, seasonHigh], [], baseRules);
    expect(r.source).toBe("season");
    // 2026-12-22 is Tuesday → no weekend mul
    expect(r.price).toBe(400);
  });

  it("override beats season and base", () => {
    const r = resolvedPriceForDate(new Date("2026-12-25T12:00:00Z"), 100, [seasonHigh, seasonLow], [override], baseRules);
    expect(r.source).toBe("override");
    // 2026-12-25 is Friday → weekend mul applies on top of override
    expect(r.price).toBeCloseTo(999 * 1.25, 2);
  });

  it("falls back to default weekend days when rules are null", () => {
    const r = resolvedPriceForDate(new Date("2026-06-19T12:00:00Z"), 100, [], [], null);
    expect(r.weekend).toBe(true);
    expect(r.price).toBe(100); // no multiplier when rules null (defaults to 1)
  });

  it("season applies weekend multiplier when configured", () => {
    // 2026-12-26 is Saturday, inside high-priority season
    const r = resolvedPriceForDate(new Date("2026-12-26T12:00:00Z"), 100, [seasonHigh], [], baseRules);
    expect(r.source).toBe("season");
    expect(r.weekend).toBe(true);
    expect(r.price).toBeCloseTo(400 * 1.25, 2);
  });
});
