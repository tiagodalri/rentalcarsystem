import { Skeleton } from "@/components/ui/skeleton";
import Navbar from "@/components/Navbar";

export function PublicPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto max-w-3xl px-4 pt-24 pb-16 flex flex-col items-center gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-64 w-full rounded-lg mt-6" />
      </div>
    </div>
  );
}
