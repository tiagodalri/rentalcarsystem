import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/* ── Fleet Report Skeleton ── */
export function FleetReportSkeleton() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in-50 duration-300">
      {/* Header + month nav */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-48 rounded-lg" />
      </div>

      {/* 4 KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border/40">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-1.5">
                  <Skeleton className="h-2.5 w-20" />
                  <Skeleton className="h-6 w-16" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[260, 260].map((h, i) => (
          <Card key={i} className="border-border/40">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-40" />
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2 pt-4" style={{ height: h }}>
                {[40, 65, 50, 80, 55, 70, 45, 60].map((p, j) => (
                  <Skeleton key={j} className="flex-1 rounded-t" style={{ height: `${p}%` }} />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-52" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30 bg-muted/20">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <th key={j} className="px-4 py-3">
                      <Skeleton className="h-2.5 w-16" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/10">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <Skeleton className="h-3 w-full max-w-[80px]" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Fleet P&L Skeleton ── */
export function FleetPnLSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-96" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* 4 KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border/40">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-1.5">
                  <Skeleton className="h-2.5 w-20" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <Skeleton className="h-9 w-full max-w-md rounded-lg" />

      {/* Table */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 1000 }}>
              <thead>
                <tr className="border-b border-border/30 bg-muted/20">
                  {Array.from({ length: 10 }).map((_, j) => (
                    <th key={j} className="px-3 py-2">
                      <Skeleton className="h-2.5 w-14" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/10">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-3 py-3">
                        <Skeleton className="h-3 w-full max-w-[70px]" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Inspection Skeleton ── */
export function InspectionSkeleton() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in-50 duration-300">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton
            key={i}
            className={`h-9 rounded-lg ${i === 0 ? "w-40" : "w-32"}`}
          />
        ))}
      </div>

      {/* Content card */}
      <Card className="border-border/40">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-44" />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Two input groups */}
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
          {/* Photo grid placeholder */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/3] rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
