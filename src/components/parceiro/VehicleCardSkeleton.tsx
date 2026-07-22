export default function VehicleCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/40 bg-card overflow-hidden animate-pulse">
      <div className="aspect-[16/10] bg-muted/60" />
      <div className="p-3.5 space-y-2.5">
        <div className="space-y-1.5">
          <div className="h-2.5 w-14 bg-muted/70 rounded" />
          <div className="h-4 w-3/4 bg-muted/70 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-3 w-10 bg-muted/50 rounded" />
          <div className="h-3 w-10 bg-muted/50 rounded" />
          <div className="h-3 w-10 bg-muted/50 rounded" />
        </div>
        <div className="h-14 bg-muted/40 rounded-lg" />
        <div className="h-8 bg-muted/40 rounded-lg" />
      </div>
    </div>
  );
}
