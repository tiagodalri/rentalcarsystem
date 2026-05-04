import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

function KpiCardSkeleton() {
  return (
    <Card className="bg-card/80 border-border/30">
      <CardContent className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-2 w-20" />
          <Skeleton className="h-4 w-4 rounded" />
        </div>
        <Skeleton className="h-6 w-16" />
      </CardContent>
    </Card>
  );
}

function KpiGridSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <KpiCardSkeleton key={i} />
      ))}
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <tr className="border-b border-border/10">
      <td className="px-5 py-3.5"><Skeleton className="h-3 w-28" /></td>
      <td className="px-5 py-3.5"><Skeleton className="h-3 w-20" /></td>
      <td className="px-5 py-3.5"><Skeleton className="h-3 w-20" /></td>
      <td className="px-5 py-3.5 text-right"><Skeleton className="h-3 w-16 ml-auto" /></td>
      <td className="px-5 py-3.5"><Skeleton className="h-5 w-20 rounded-md" /></td>
    </tr>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>

      {/* 3 KPI sections */}
      {["Operacional", "Frota", "Financeiro"].map((label) => (
        <section key={label} className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <KpiGridSkeleton />
        </section>
      ))}

      {/* Recent bookings table */}
      <Card className="bg-card/80 border-border/30">
        <CardContent className="p-0">
          <div className="px-5 py-4 border-b border-border/20">
            <Skeleton className="h-4 w-36" />
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/20">
                {["w-16", "w-14", "w-14", "w-10", "w-14"].map((w, i) => (
                  <th key={i} className={`px-5 py-3 ${i === 3 ? "text-right" : "text-left"}`}>
                    <Skeleton className={`h-2 ${w}`} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <TableRowSkeleton key={i} />
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
