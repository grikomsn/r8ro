import { toast } from "sonner";

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function throwIfSupabaseError(
  error: { message?: string } | null,
  fallback: string
) {
  if (error) {
    throw new Error(error.message || fallback);
  }
}

/**
 * Logs a failed action and tells the user about it. Optimistic updates are
 * rolled back silently otherwise, which looks like the click did nothing.
 */
export function reportActionError(action: string, error: unknown) {
  console.error(`${action} failed:`, error);
  toast.error(action, {
    description: getErrorMessage(error, "Please try again."),
  });
}
