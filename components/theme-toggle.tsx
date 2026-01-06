"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        aria-label="Toggle theme"
        className="h-9 w-9 rounded-lg border-2 border-border bg-transparent p-0 shadow-sm md:h-10 md:w-10"
        disabled
        variant="outline"
      >
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Toggle theme"
          className="h-9 w-9 rounded-lg border-2 border-border bg-transparent p-0 shadow-sm md:h-10 md:w-10"
          variant="outline"
        >
          {theme === "light" && <Sun className="h-4 w-4" />}
          {theme === "dark" && <Moon className="h-4 w-4" />}
          {theme === "system" && <Monitor className="h-4 w-4" />}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="rounded-xl border-2 border-border"
      >
        <DropdownMenuItem className="gap-2" onClick={() => setTheme("light")}>
          <Sun className="h-4 w-4" />
          Light
          {theme === "light" && (
            <span className="ml-auto font-bold text-primary">✓</span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onClick={() => setTheme("dark")}>
          <Moon className="h-4 w-4" />
          Dark
          {theme === "dark" && (
            <span className="ml-auto font-bold text-primary">✓</span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onClick={() => setTheme("system")}>
          <Monitor className="h-4 w-4" />
          System
          {theme === "system" && (
            <span className="ml-auto font-bold text-primary">✓</span>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
