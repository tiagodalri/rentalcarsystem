import { Skeleton } from "@/components/ui/skeleton";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

/** Skeleton for SearchResults — grid of vehicle cards */
export function SearchResultsSkeleton() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar />
      <section className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Back link + title */}
          <div className="mb-10">
            <Skeleton className="h-4 w-36 mb-6" />
            <Skeleton className="h-8 w-64 mb-4" />
            <Skeleton className="h-10 w-80 rounded-xl" />
          </div>

          {/* Vehicle cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-border/40 bg-card/40 overflow-hidden"
              >
                {/* Image placeholder */}
                <Skeleton className="h-48 sm:h-64 w-full rounded-none" />

                {/* Info */}
                <div className="p-5">
                  <Skeleton className="h-5 w-40 mb-1" />
                  <Skeleton className="h-3 w-24 mb-4" />

                  <div className="flex items-center gap-4 mb-4">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-16" />
                  </div>

                  <div className="border-t border-border/40 pt-4 flex items-end justify-between">
                    <div>
                      <Skeleton className="h-2 w-16 mb-1" />
                      <Skeleton className="h-7 w-24" />
                    </div>
                    <Skeleton className="h-9 w-28 rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}

/** Skeleton for BookingDetails — vehicle detail + sidebar pricing */
export function BookingDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar />
      <section className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-5xl">
          {/* Back link */}
          <Skeleton className="h-4 w-36 mb-6" />

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* LEFT col */}
            <div className="lg:col-span-3 space-y-5">
              {/* Vehicle image */}
              <div className="rounded-xl overflow-hidden border border-border/40">
                <Skeleton className="h-56 sm:h-72 w-full rounded-none" />
              </div>

              {/* Specs card */}
              <div className="rounded-xl border border-border/40 bg-card p-5">
                <Skeleton className="h-3 w-24 mb-2" />
                <Skeleton className="h-4 w-48 mb-3" />
                <div className="flex items-center gap-4">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>

              {/* Plan selector placeholder */}
              <div className="rounded-xl border border-border/40 bg-card p-5 space-y-4">
                <Skeleton className="h-5 w-40" />
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              </div>

              {/* Features */}
              <div className="rounded-xl border border-border/40 bg-card p-5 space-y-3">
                <Skeleton className="h-5 w-36" />
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-4 w-full" />
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT col. pricing sidebar */}
            <div className="lg:col-span-2 space-y-5">
              {/* Trip summary */}
              <div className="rounded-xl border border-border/40 bg-card p-5 space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>

              {/* Price breakdown */}
              <div className="rounded-xl border border-border/40 bg-card p-5 space-y-3">
                <Skeleton className="h-5 w-36" />
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
                <div className="border-t border-border/40 pt-3 flex justify-between">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
              </div>

              {/* CTA button */}
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
