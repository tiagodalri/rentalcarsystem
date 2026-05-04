import { Skeleton } from "@/components/ui/skeleton";

export function AdminShellSkeleton() {
  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar skeleton */}
      <div className="hidden md:flex w-64 flex-col border-r border-border/40 bg-card p-4 space-y-6">
        {/* Logo */}
        <Skeleton className="h-8 w-32" />
        {/* Nav items */}
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-2 py-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-14 flex items-center gap-4 border-b border-border/40 px-4">
          <Skeleton className="h-6 w-6 rounded md:hidden" />
          <div className="flex-1" />
          <Skeleton className="h-6 w-6 rounded" />
          <Skeleton className="h-3 w-36 hidden md:block" />
        </div>

        {/* Content placeholder */}
        <div className="flex-1 p-4 md:p-6 space-y-4">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border/40 bg-card p-6 space-y-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-8 w-28" />
              </div>
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-lg mt-4" />
        </div>
      </div>
    </div>
  );
}
