// Length limits for user supplied text. These mirror the CHECK constraints
// added by the migration 20261021090500_add_text_length_constraints.sql, so
// the UI rejects what the database would reject.

export const FIELD_LIMITS = {
  cardContent: 10_000,
  participantName: 80,
  sessionTitle: 200,
  story: 10_000,
  voteValue: 32,
} as const;
