import Link from "next/link";
import { cn } from "@/lib/utils";

interface AppLogoProps {
  /** Colour of the "8"; override it on an amber background. */
  accentClassName?: string;
  className?: string;
  href?: string;
}

export function AppLogo({
  accentClassName = "text-primary",
  className,
  href = "/",
}: AppLogoProps) {
  return (
    <Link
      aria-label="r8ro home"
      className={cn(
        "shrink-0 rounded-md font-black font-mono text-xl uppercase tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-2xl",
        className
      )}
      href={href}
    >
      r<span className={accentClassName}>8</span>ro
    </Link>
  );
}
