const adjectives = [
  "swift",
  "bold",
  "calm",
  "bright",
  "clever",
  "cosmic",
  "daring",
  "eager",
  "fierce",
  "gentle",
  "happy",
  "jolly",
  "keen",
  "lively",
  "merry",
  "noble",
  "proud",
  "quick",
  "rapid",
  "sharp",
  "sunny",
  "vivid",
  "witty",
  "zesty",
];

const nouns = [
  "falcon",
  "tiger",
  "phoenix",
  "dragon",
  "panda",
  "eagle",
  "wolf",
  "bear",
  "lion",
  "hawk",
  "raven",
  "cobra",
  "shark",
  "whale",
  "dolphin",
  "panther",
  "jaguar",
  "leopard",
  "cheetah",
  "lynx",
  "otter",
  "fox",
  "owl",
  "crane",
];

const usernameAdjectives = [
  "Happy",
  "Clever",
  "Swift",
  "Brave",
  "Calm",
  "Eager",
  "Gentle",
  "Kind",
  "Wise",
  "Jolly",
  "Lucky",
  "Mighty",
  "Noble",
  "Proud",
  "Quick",
  "Sharp",
  "Sunny",
  "Witty",
  "Zesty",
  "Cool",
];

const usernameNouns = [
  "Panda",
  "Tiger",
  "Eagle",
  "Dolphin",
  "Fox",
  "Owl",
  "Bear",
  "Wolf",
  "Hawk",
  "Raven",
  "Koala",
  "Otter",
  "Penguin",
  "Rabbit",
  "Falcon",
  "Phoenix",
  "Dragon",
  "Lion",
  "Shark",
  "Whale",
];

export function generateSlug(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  // A four digit suffix gives 24 x 24 x 10000 = 5,760,000 combinations, which
  // makes an accidental collision far less likely than a three digit one.
  const num = Math.floor(Math.random() * 10_000);
  return `${adj}-${noun}-${num}`;
}

// Postgres error code for a unique constraint violation.
export const UNIQUE_VIOLATION_CODE = "23505";

export interface SlugInsertError {
  code?: string;
  message?: string;
}

/**
 * Retries an insert that failed because the generated slug was already taken.
 * The slug space is large but finite, so a collision is possible.
 */
export function withSlugRetry<T>(
  attempt: (slug: string) => Promise<{
    data: T | null;
    error: SlugInsertError | null;
  }>,
  maxAttempts = 3
): Promise<{ data: T | null; error: SlugInsertError | null }> {
  // The attempts are sequential on purpose: each retry only happens after the
  // previous attempt failed with a unique violation.
  const tryOnce = (
    remainingAttempts: number
  ): Promise<{ data: T | null; error: SlugInsertError | null }> =>
    attempt(generateSlug()).then((result) => {
      const error = result.error;

      if (!error || error.code !== UNIQUE_VIOLATION_CODE) {
        return result;
      }

      if (remainingAttempts <= 1) {
        return result;
      }

      return tryOnce(remainingAttempts - 1);
    });

  return tryOnce(maxAttempts);
}

// Removed generateUserId() - now using Supabase Auth UUIDs (auth.uid())

export function generateRandomUsername(): string {
  const adj =
    usernameAdjectives[Math.floor(Math.random() * usernameAdjectives.length)];
  const noun = usernameNouns[Math.floor(Math.random() * usernameNouns.length)];
  return `${adj}${noun}`;
}
