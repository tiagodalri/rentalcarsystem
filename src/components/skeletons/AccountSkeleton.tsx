import { Skeleton } from "@/components/ui/skeleton";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export function AccountSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto max-w-5xl px-3 sm:px-4 pt-20 sm:pt-24 pb-16">
        {/* Header skeleton */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/40 bg-card p-4 text-center space-y-2">
              <Skeleton className="h-5 w-5 mx-auto rounded" />
              <Skeleton className="h-3 w-20 mx-auto" />
              <Skeleton className="h-6 w-10 mx-auto" />
            </div>
          ))}
        </div>

        {/* Tabs skeleton */}
        <div className="mt-10 space-y-4">
          <Skeleton className="h-10 w-full rounded-lg" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/40 bg-card p-4 flex items-center gap-4">
              <Skeleton className="h-16 w-24 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
