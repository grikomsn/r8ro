"use client";

import { LayoutGrid, Spade } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserAccountPopover } from "@/components/auth/user-account-popover";
import { AppLogo } from "@/components/shared/app-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Retro", icon: LayoutGrid },
  { href: "/poker", label: "Poker", icon: Spade },
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="border-border border-b-2 bg-background">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-3 md:gap-6">
          <AppLogo />
          <nav aria-label="Main">
            <ul className="flex items-center gap-1 rounded-xl border-2 border-border bg-muted p-1">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href;
                return (
                  <li key={href}>
                    <Link
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-bold text-sm transition-colors sm:px-3",
                        isActive
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      href={href}
                    >
                      <Icon aria-hidden="true" className="h-4 w-4" />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <UserAccountPopover />
        </div>
      </div>
    </header>
  );
}
