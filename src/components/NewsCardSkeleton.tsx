import { Skeleton } from "@/components/ui/skeleton";

export function NewsCardSkeleton() {
  return (
    <article className="bg-card border rounded-xl overflow-hidden">
      <div className="flex gap-0">
        {/* Thumbnail skeleton */}
        <Skeleton className="flex-shrink-0 w-36 sm:w-44 h-28" />

        {/* Content skeleton */}
        <div className="flex flex-col flex-1 p-3 gap-2">
          {/* Source row */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-4 w-16 rounded ml-auto" />
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>

          {/* Summary */}
          <div className="space-y-1">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-auto">
            <Skeleton className="h-5 w-6 rounded" />
            <Skeleton className="h-5 w-6 rounded" />
            <Skeleton className="h-5 w-6 rounded" />
            <Skeleton className="h-6 w-14 rounded ml-auto" />
          </div>
        </div>
      </div>
    </article>
  );
}
