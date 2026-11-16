import { NON_ESTIMATE_VALUES } from "@/lib/constants/poker-scales";

export interface VoteLike {
  value: string;
  voter: string;
}

export interface PokerStats {
  average: number | null;
  /** True when every estimate (ignoring "?" and breaks) is the same. */
  consensus: boolean;
  /** Vote counts in scale order, including values nobody picked. */
  distribution: { count: number; value: string }[];
  estimateCount: number;
  highest: VoteLike[];
  isNumeric: boolean;
  lowest: VoteLike[];
  maxCount: number;
  /** Votes that are "?" or a break rather than an estimate. */
  nonEstimateCount: number;
  /** True when the estimates are more than one scale step apart. */
  spreadIsWide: boolean;
  suggestion: string | null;
  total: number;
}

function toNumber(value: string) {
  const parsed = Number(value);
  return value.trim() !== "" && Number.isFinite(parsed) ? parsed : null;
}

export function computePokerStats(
  scale: string[],
  votes: VoteLike[]
): PokerStats {
  const counts = new Map<string, number>();
  for (const vote of votes) {
    counts.set(vote.value, (counts.get(vote.value) ?? 0) + 1);
  }

  const distribution = scale.map((value) => ({
    value,
    count: counts.get(value) ?? 0,
  }));
  // Values no longer on the scale (the host changed it) are still shown.
  for (const [value, count] of counts) {
    if (!scale.includes(value)) {
      distribution.push({ value, count });
    }
  }

  const estimates = votes.filter(
    (vote) => !NON_ESTIMATE_VALUES.has(vote.value)
  );
  const estimateScale = scale.filter(
    (value) => !NON_ESTIMATE_VALUES.has(value)
  );
  const isNumeric =
    estimates.length > 0 &&
    estimates.every((vote) => toNumber(vote.value) !== null);

  const rank = (value: string) => {
    if (isNumeric) {
      return toNumber(value) ?? 0;
    }
    const index = estimateScale.indexOf(value);
    return index === -1 ? Number.POSITIVE_INFINITY : index;
  };

  const sorted = [...estimates].sort((a, b) => rank(a.value) - rank(b.value));
  const lowestValue = sorted[0]?.value;
  const highestValue = sorted.at(-1)?.value;
  const consensus =
    estimates.length > 0 && estimates.every((v) => v.value === lowestValue);

  let average: number | null = null;
  let suggestion: string | null = null;

  if (isNumeric) {
    const numbers = estimates.map((vote) => toNumber(vote.value) ?? 0);
    average = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    const candidates = estimateScale
      .map((value) => ({ value, n: toNumber(value) }))
      .filter((c): c is { value: string; n: number } => c.n !== null);
    // Nearest scale value to the average; a tie rounds up, because
    // underestimating is the more common mistake.
    let best: { value: string; n: number } | null = null;
    for (const candidate of candidates) {
      if (
        !best ||
        Math.abs(candidate.n - average) < Math.abs(best.n - average) ||
        (Math.abs(candidate.n - average) === Math.abs(best.n - average) &&
          candidate.n > best.n)
      ) {
        best = candidate;
      }
    }
    suggestion = best?.value ?? null;
  } else if (sorted.length > 0) {
    // Ordinal scales such as T-shirt sizes use the median, rounded up.
    suggestion = sorted[Math.floor(sorted.length / 2)]?.value ?? null;
  }

  const lowIndex = lowestValue ? estimateScale.indexOf(lowestValue) : -1;
  const highIndex = highestValue ? estimateScale.indexOf(highestValue) : -1;
  const spreadIsWide =
    !consensus && lowIndex !== -1 && highIndex !== -1
      ? highIndex - lowIndex > 1
      : false;

  return {
    average,
    consensus,
    distribution,
    estimateCount: estimates.length,
    highest: consensus
      ? []
      : estimates.filter((vote) => vote.value === highestValue),
    isNumeric,
    lowest: consensus
      ? []
      : estimates.filter((vote) => vote.value === lowestValue),
    maxCount: Math.max(0, ...distribution.map((d) => d.count)),
    nonEstimateCount: votes.length - estimates.length,
    spreadIsWide,
    suggestion,
    total: votes.length,
  };
}
