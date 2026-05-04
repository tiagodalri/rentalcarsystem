import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

function FinanceKpiCard() {
  return (
    <Card className="border-border/30">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <Skeleton className="w-9 h-9 rounded-lg" />
          <Skeleton className="h-4 w-4" />
        </div>
        <Skeleton className="h-6 w-24 mb-1" />
        <Skeleton className="h-2 w-20" />
      </CardContent>
    </Card>
  );
}

function ChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div className="flex items-end gap-2 pt-4" style={{ height }}>
      {[40, 65, 50, 80, 55, 70, 45, 60].map((h, i) => (
        <Skeleton key={i} className="flex-1 rounded-t" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

function ProgressBarSkeleton() {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
    </div>
  );
}

export function FinanceSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <Skeleton className="h-8 w-52 rounded-lg" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <FinanceKpiCard key={i} />
        ))}
      </div>

      {/* 2 charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <Card key={i} className="border-border/30">
            <CardContent className="p-5">
              <Skeleton className="h-4 w-40 mb-4" />
              <ChartSkeleton />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-border/30 lg:col-span-2">
          <CardContent className="p-5">
            <Skeleton className="h-4 w-32 mb-4" />
            <ChartSkeleton height={220} />
          </CardContent>
        </Card>
        <Card className="border-border/30">
          <CardContent className="p-5">
            <Skeleton className="h-4 w-40 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <ProgressBarSkeleton key={i} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      <Card className="border-border/30">
        <CardContent className="p-5">
          <Skeleton className="h-4 w-36 mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-3 w-20 mx-auto mb-2" />
                <Skeleton className="h-5 w-10 mx-auto" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
