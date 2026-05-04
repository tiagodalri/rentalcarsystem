import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

interface CardGridSkeletonProps {
  count?: number;
  cols?: string;
  /** "fleet" shows image + vehicle info; "team" shows avatar + role info */
  variant?: "fleet" | "team";
}

export function CardGridSkeleton({ count = 6, cols = "grid-cols-1 md:grid-cols-2 lg:grid-cols-3", variant = "fleet" }: CardGridSkeletonProps) {
  return (
    <div className={`grid ${cols} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="bg-card/50 border-border/40 overflow-hidden">
          {variant === "fleet" && (
            <Skeleton className="h-40 w-full rounded-none" />
          )}
          <CardContent className="p-4 space-y-3">
            {variant === "fleet" ? (
              <>
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-2.5 w-20" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="flex gap-4">
                  <Skeleton className="h-3 w-8" />
                  <Skeleton className="h-3 w-8" />
                  <Skeleton className="h-3 w-10" />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                  <Skeleton className="h-5 w-20" />
                  <div className="flex gap-2">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <Skeleton key={j} className="h-4 w-4 rounded" />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-2.5 w-36" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="space-y-1.5 pt-2">
                  <Skeleton className="h-2.5 w-40" />
                  <Skeleton className="h-2.5 w-32" />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
