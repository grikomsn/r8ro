import { ROLE_LABELS } from "@/lib/constants/organizations";
import type { OrganizationRole } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROLE_CLASSES: Record<OrganizationRole, string> = {
  owner: "bg-primary text-primary-foreground",
  admin: "bg-periwinkle text-ink",
  member: "bg-muted text-muted-foreground",
};

export function RoleBadge({
  className,
  role,
}: {
  className?: string;
  role: OrganizationRole;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-bold text-[11px] leading-4",
        ROLE_CLASSES[role],
        className
      )}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}
