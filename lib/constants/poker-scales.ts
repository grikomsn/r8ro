export const VOTING_SCALES = {
  fibonacci: ["1", "2", "3", "5", "8", "13", "21", "?"],
  tshirt: ["XS", "S", "M", "L", "XL", "XXL", "?"],
  linear: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
} as const;

export type VotingScaleType = keyof typeof VOTING_SCALES;

