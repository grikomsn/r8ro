// Display names are shown to other participants, so they are limited to a
// sensible length. The same rules are applied on every surface that accepts a
// name, otherwise a name accepted in one place could be rejected in another.

export const USERNAME_MAX_LENGTH = 30;

// Letters, numbers, spaces, underscores and hyphens. Spaces are allowed
// because most real names contain them.
export const USERNAME_REGEX = /^[a-zA-Z0-9 _-]+$/;

export const USERNAME_ERRORS = {
  required: "Please enter your name",
  tooLong: `Name must be ${USERNAME_MAX_LENGTH} characters or less`,
  invalid:
    "Name can only contain letters, numbers, spaces, underscores, and hyphens",
} as const;

export function validateUsername(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return USERNAME_ERRORS.required;
  }

  if (trimmed.length > USERNAME_MAX_LENGTH) {
    return USERNAME_ERRORS.tooLong;
  }

  if (!USERNAME_REGEX.test(trimmed)) {
    return USERNAME_ERRORS.invalid;
  }

  return null;
}
