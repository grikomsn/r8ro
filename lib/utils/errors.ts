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
 * Row level security hides a row you may not change, so an update or delete
 * of it succeeds with zero rows instead of failing. Call this with the rows
 * returned by `.select()` to turn that into an error.
 */
export function throwIfNoRows(rows: unknown[] | null, message: string) {
  if (!rows || rows.length === 0) {
    throw new Error(message);
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
