import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
  rows?: number;
  columns: { width: string; align?: "left" | "right" | "center" }[];
}

export function TableSkeleton({ rows = 8, columns }: TableSkeletonProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/30 bg-muted/20">
            {columns.map((col, j) => (
              <th key={j} className="px-5 py-3">
                <Skeleton className={`h-2.5 ${col.width}`} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="border-b border-border/10">
              {columns.map((col, j) => (
                <td key={j} className={`px-5 py-3.5 ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""}`}>
                  <Skeleton className={`h-3 ${col.width}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
