import { Skeleton } from "@/components/ui/skeleton";

export function NewsCardSkeleton() {
  return (
    <div className="bg-card rounded-lg border overflow-hidden h-[140px]">
      <div className="flex flex-row h-full">
        {/* Left: Thumbnail placeholder */}
        <div className="w-[180px] flex-shrink-0">
          <Skeleton className="w-full h-full" />
        </div>

        {/* Right: Content placeholder */}
        <div className="flex-1 flex flex-col justify-between p-4 min-w-0">
          {/* Top: Source + Date */}
          <div className="flex items-center gap-2 mb-1">
            <Skeleton className="w-2 h-2 rounded-full" />
            <Skeleton className="w-16 h-3" />
            <Skeleton className="w-1 h-1 rounded-full" />
            <Skeleton className="w-12 h-3" />
          </div>

          {/* Title */}
          <Skeleton className="w-full h-5 mb-1" />
          <Skeleton className="w-3/4 h-5 mb-2" />

          {/* Summary */}
          <Skeleton className="w-full h-4 mb-1" />
          <Skeleton className="w-2/3 h-4 flex-1" />

          {/* Bottom: Actions */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t">
            <div className="flex items-center gap-1">
              <Skeleton className="w-6 h-6 rounded-full" />
              <Skeleton className="w-6 h-6 rounded-full" />
              <Skeleton className="w-6 h-6 rounded-full" />
              <Skeleton className="w-6 h-6 rounded-full" />
            </div>
            <div className="flex items-center gap-1">
              <Skeleton className="w-7 h-7 rounded-md" />
              <Skeleton className="w-7 h-7 rounded-md" />
              <Skeleton className="w-7 h-7 rounded-md" />
              <Skeleton className="w-7 h-7 rounded-md" />
              <Skeleton className="w-14 h-7 rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
