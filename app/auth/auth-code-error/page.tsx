import Link from "next/link";
import { Button } from "@/components/ui/button";

interface AuthCodeErrorPageProps {
  searchParams: Promise<{ reason?: string }>;
}

const MESSAGES: Record<string, { body: string; hint: string }> = {
  merge_pending: {
    body: "Your GitHub sign-in worked, but moving your guest data to it did not finish.",
    hint: "Your data is still safe. Try the transfer again, and if it keeps failing export your data from the account menu.",
  },
  source_expired: {
    body: "Your GitHub sign-in worked, but the guest account it should have been linked to is no longer available.",
    hint: "Your guest data is still in the database. If you have it exported, it can be restored by hand.",
  },
  source_unavailable: {
    body: "Your GitHub sign-in worked, but the guest account to transfer could not be confirmed.",
    hint: "Your guest data is still in the database. If you have it exported, it can be restored by hand.",
  },
};

export default async function AuthCodeErrorPage({
  searchParams,
}: AuthCodeErrorPageProps) {
  const { reason } = await searchParams;
  const message = reason ? MESSAGES[reason] : undefined;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 rounded-xl border-2 border-border bg-card p-8 text-center shadow-lg">
        <div className="space-y-2">
          <h1 className="font-bold text-3xl text-foreground">
            Authentication Error
          </h1>
          {message ? (
            <p className="text-muted-foreground">{message.body}</p>
          ) : (
            <p className="text-muted-foreground">
              There was an error linking your GitHub account. This could be
              because:
            </p>
          )}
        </div>

        {message ? (
          <p className="text-left text-muted-foreground text-sm">
            {message.hint}
          </p>
        ) : (
          <ul className="space-y-2 text-left text-muted-foreground text-sm">
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
        )}

        <div className="space-y-3 pt-4">
          {reason === "merge_pending" && (
            <form action="/auth/link/retry" method="post">
              <Button className="w-full" size="lg" type="submit">
                Retry data transfer
              </Button>
            </form>
          )}

          {reason !== "merge_pending" && (
            <Button asChild className="w-full" size="lg">
              <Link href="/">Return to Home</Link>
            </Button>
          )}

          <p className="text-muted-foreground text-xs">
            {reason === "merge_pending"
              ? "If the transfer keeps failing, export your data from the account menu before it is lost."
              : "You can try linking your account again from your profile."}
          </p>
        </div>
      </div>
    </div>
  );
}
