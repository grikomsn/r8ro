import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function AuthCodeErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 rounded-xl border-2 border-border bg-card p-8 text-center shadow-lg">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Authentication Error</h1>
          <p className="text-muted-foreground">
            There was an error linking your GitHub account. This could be because:
          </p>
        </div>

        <ul className="space-y-2 text-left text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="mt-0.5">•</span>
            <span>The authentication code was invalid or expired</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5">•</span>
            <span>You cancelled the GitHub authorization</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5">•</span>
            <span>The redirect URL is not configured correctly</span>
          </li>
        </ul>

        <div className="space-y-3 pt-4">
          <Button asChild className="w-full" size="lg">
            <Link href="/">Return to Home</Link>
          </Button>
          <p className="text-xs text-muted-foreground">You can try linking your account again from your profile.</p>
        </div>
      </div>
    </div>
  )
}
