import { Skeleton } from "@/components/ui/skeleton";

export function NewsCardSkeleton() {
  return (
    <article className="bg-card rounded-lg border overflow-hidden">
      {/* Cover Image Skeleton */}
      <Skeleton className="aspect-video w-full" />

      {/* Content */}
      <div className="p-5">
        {/* Metadata */}
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>

        {/* Headline */}
        <Skeleton className="h-7 w-full mb-2" />
        <Skeleton className="h-7 w-3/4 mb-3" />

        {/* Summary */}
        <div className="space-y-2 mb-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
          <Skeleton className="h-9 w-36" />
        </div>
      </div>
    </article>
  );
}
