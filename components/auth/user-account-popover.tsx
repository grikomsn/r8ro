"use client"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useAuth } from "@/hooks/use-auth"
import { Github, User, ShieldCheck, UserCircle } from "lucide-react"

interface UserAccountPopoverProps {
  variant?: "default" | "compact"
}

export function UserAccountPopover({ variant = "default" }: UserAccountPopoverProps) {
  const { userId, displayName, isAnonymous, linkGitHubIdentity, isLoading } = useAuth()

  const handleLinkGitHub = async () => {
    const result = await linkGitHubIdentity()
    if (!result.success) {
      alert(`Failed to link GitHub: ${result.error}`)
    }
  }

  if (!userId) return null

  const isCompact = variant === "compact"

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`group flex items-center gap-2 rounded-full border-2 transition-all hover:shadow-md ${
            isAnonymous
              ? "border-amber-400 bg-amber-50 hover:bg-amber-100 hover:border-amber-500"
              : "border-green-400 bg-green-50 hover:bg-green-100 hover:border-green-500"
          } ${isCompact ? "py-1 pl-1 pr-2.5" : "py-1.5 pl-1.5 pr-3"}`}
          aria-label="User account menu"
        >
          {/* Avatar circle with status indicator */}
          <div className="relative">
            <div
              className={`flex items-center justify-center rounded-full ${
                isAnonymous ? "bg-amber-200" : "bg-green-200"
              } ${isCompact ? "h-6 w-6" : "h-7 w-7"}`}
            >
              {isAnonymous ? (
                <UserCircle className={`text-amber-700 ${isCompact ? "h-4 w-4" : "h-5 w-5"}`} />
              ) : (
                <Github className={`text-green-700 ${isCompact ? "h-3.5 w-3.5" : "h-4 w-4"}`} />
              )}
            </div>
            {/* Status dot */}
            <div
              className={`absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white ${
                isAnonymous ? "bg-amber-500" : "bg-green-500"
              } ${isCompact ? "h-2.5 w-2.5" : "h-3 w-3"}`}
            />
          </div>

          {/* Display name or anonymous label */}
          <span
            className={`font-semibold truncate max-w-[100px] ${
              isAnonymous ? "text-amber-800" : "text-green-800"
            } ${isCompact ? "text-xs" : "text-sm"}`}
          >
            {displayName || (isAnonymous ? "Guest" : "User")}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 rounded-xl" align="end">
        <div className="border-b-2 border-border bg-muted px-4 py-3 rounded-t-xl">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-base font-bold uppercase">Account</h3>
          </div>
        </div>

        <div className="space-y-4 p-4">
          {/* User Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-muted-foreground">Display Name</span>
              <span className="text-sm font-semibold">{displayName || "Not set"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-muted-foreground">User ID</span>
              <code className="text-xs font-mono font-semibold">{userId.slice(0, 8)}...</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-muted-foreground">Status</span>
              <div className="flex items-center gap-1.5">
                {isAnonymous ? (
                  <>
                    <div className="h-2 w-2 rounded-full bg-amber-500" />
                    <span className="text-xs font-semibold text-amber-600">Anonymous</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5 text-green-600" aria-hidden="true" />
                    <span className="text-xs font-semibold text-green-600">Linked</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Upgrade Section */}
          {isAnonymous && (
            <>
              <div className="h-px bg-border" />
              <div className="space-y-3">
                <div className="rounded-xl bg-muted p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    <strong className="text-foreground">Upgrade your account</strong> to keep your data permanently and
                    access it from any device.
                  </p>
                </div>
                <Button onClick={handleLinkGitHub} disabled={isLoading} size="lg" className="w-full rounded-xl">
                  <Github className="mr-2 h-4 w-4" aria-hidden="true" />
                  Link GitHub Account
                </Button>
                <p className="text-[10px] text-muted-foreground text-center">
                  Your current user ID and all data will be preserved after linking.
                </p>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
