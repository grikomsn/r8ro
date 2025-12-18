import { Card, CardContent, CardHeader } from "@/components/ui/card"

export function SkeletonCard() {
  return (
    <Card className="rounded-xl border-2 border-border bg-background shadow-sm">
      <CardHeader className="pb-3">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  )
}

export function SkeletonBoardHeader() {
  return (
    <div className="flex items-center justify-between gap-4 rounded-t-xl border-b-2 border-border bg-background px-4 py-4 shadow-sm md:px-6">
      <div className="flex items-center gap-4">
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-10 w-10 animate-pulse rounded-lg bg-muted" />
        <div className="h-10 w-10 animate-pulse rounded-lg bg-muted" />
        <div className="h-10 w-10 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  )
}

export function SkeletonColumn() {
  return (
    <div className="flex min-h-[400px] flex-col rounded-xl border-2 border-border bg-background shadow-sm">
      <div className="border-b-2 border-border bg-muted p-4">
        <div className="h-6 w-32 animate-pulse rounded bg-background" />
      </div>
      <div className="flex-1 space-y-3 p-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}
