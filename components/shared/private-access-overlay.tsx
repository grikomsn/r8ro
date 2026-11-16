import { Lock } from "lucide-react";
import { FullPageMessage } from "@/components/shared/full-page-status";

interface PrivateAccessOverlayProps {
  description: string;
  homeHref: string;
  title: string;
}

export function PrivateAccessOverlay({
  title,
  description,
  homeHref,
}: PrivateAccessOverlayProps) {
  return (
    <FullPageMessage
      description={description}
      homeHref={homeHref}
      icon={<Lock aria-hidden="true" className="h-6 w-6" />}
      title={title}
    />
  );
}
