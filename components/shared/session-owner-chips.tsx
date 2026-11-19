import { Archive, Building2 } from "lucide-react";
import Link from "next/link";

/**
 * The organization that owns a session, for the session header's status
 * line. On phones only the icon shows, so the line never wraps.
 */
export function OrganizationChip({
  organization,
}: {
  organization: { name: string; slug: string };
}) {
  return (
    <Link
      className="-my-1 inline-flex min-h-6 min-w-6 shrink-0 items-center justify-center gap-1 rounded-full bg-sage px-1.5 font-bold text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      href={`/orgs/${organization.slug}`}
      title={organization.name}
    >
      <Building2 aria-hidden="true" className="h-3 w-3 shrink-0" />
      <span className="max-w-32 truncate max-sm:sr-only">
        {organization.name}
      </span>
    </Link>
  );
}

export function ArchivedChip() {
  return (
    <span className="inline-flex items-center gap-1 font-bold text-foreground">
      <Archive aria-hidden="true" className="h-3 w-3" />
      <span className="max-sm:sr-only">Archived</span>
    </span>
  );
}
