export const VOTING_SCALES = {
  fibonacci: ["0", "1", "2", "3", "5", "8", "13", "21", "?", "☕"],
  tshirt: ["XS", "S", "M", "L", "XL", "XXL", "?", "☕"],
  linear: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "?"],
} as const;

export type VotingScaleType = keyof typeof VOTING_SCALES;

export const VOTING_SCALE_LABELS: Record<VotingScaleType, string> = {
  fibonacci: "Fibonacci",
  tshirt: "T-shirt",
  linear: "1 – 10",
};

/** Values that mean "not sure" or "need a break" rather than an estimate. */
export const NON_ESTIMATE_VALUES = new Set(["?", "☕"]);

export function detectScaleType(scale: string[]): VotingScaleType | null {
  for (const [type, values] of Object.entries(VOTING_SCALES)) {
    if (
      values.length === scale.length &&
      values.every((value, index) => scale[index] === value)
    ) {
      return type as VotingScaleType;
    }
  }
  return null;
}
