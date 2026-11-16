import Link from "next/link";
import { cn } from "@/lib/utils";

interface AppLogoProps {
  className?: string;
  href?: string;
}

export function AppLogo({ className, href = "/" }: AppLogoProps) {
  return (
    <Link
      aria-label="r8ro home"
      className={cn(
        "shrink-0 rounded-md font-black font-mono text-xl uppercase tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-2xl",
        className
      )}
      href={href}
    >
      r<span className="text-primary">8</span>ro
    </Link>
  );
}
