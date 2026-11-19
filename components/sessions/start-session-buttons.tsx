import { LayoutGrid, Spade } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Links to the retro and poker create forms, preset to an organization. */
export function StartSessionButtons({ orgSlug }: { orgSlug?: string }) {
  const query = orgSlug ? `?org=${encodeURIComponent(orgSlug)}` : "";
  return (
    <>
      <Button asChild className="rounded-lg font-bold" size="sm">
        <Link href={`/${query}`}>
          <LayoutGrid aria-hidden="true" className="mr-2 h-4 w-4" />
          New retro
        </Link>
      </Button>
      <Button
        asChild
        className="rounded-lg font-bold"
        size="sm"
        variant="outline"
      >
        <Link href={`/poker${query}`}>
          <Spade aria-hidden="true" className="mr-2 h-4 w-4" />
          New poker
        </Link>
      </Button>
    </>
  );
}
