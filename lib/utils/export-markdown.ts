import type {
  ColumnType,
  PokerRound,
  PokerSession,
  RetroBoard,
  RetroCard,
} from "@/lib/types";

export const RETRO_COLUMNS: { type: ColumnType; title: string }[] = [
  { type: "went_well", title: "Went well" },
  { type: "to_improve", title: "To improve" },
  { type: "action_items", title: "Action items" },
];

function quoteLines(text: string) {
  return text.trim().replace(/\r?\n/g, "\n  ");
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function retroToMarkdown(
  board: RetroBoard,
  cards: RetroCard[],
  participantNames: string[]
) {
  const lines: string[] = [
    `# ${board.title}`,
    "",
    `Retro on ${formatDate(board.created_at)} · ${participantNames.length} participant${participantNames.length === 1 ? "" : "s"} · ${cards.length} card${cards.length === 1 ? "" : "s"}`,
  ];

  if (participantNames.length > 0) {
    lines.push("", `Participants: ${participantNames.join(", ")}`);
  }

  for (const column of RETRO_COLUMNS) {
    const columnCards = cards
      .filter((card) => card.column_type === column.type)
      .sort((a, b) => b.votes - a.votes);

    lines.push("", `## ${column.title} (${columnCards.length})`, "");

    if (columnCards.length === 0) {
      lines.push("_No cards._");
      continue;
    }

    for (const card of columnCards) {
      const prefix = column.type === "action_items" ? "- [ ] " : "- ";
      const votes =
        card.votes > 0
          ? ` (${card.votes} vote${card.votes === 1 ? "" : "s"})`
          : "";
      lines.push(
        `${prefix}${quoteLines(card.content)}${votes} — _${card.author_name}_`
      );
    }
  }

  lines.push("", `_Exported from r8ro · ${board.slug}_`, "");
  return lines.join("\n");
}

export function pokerToMarkdown(session: PokerSession, rounds: PokerRound[]) {
  const lines: string[] = [
    `# ${session.title}`,
    "",
    `Planning poker on ${formatDate(session.created_at)} · ${rounds.length} estimated stor${rounds.length === 1 ? "y" : "ies"}`,
    "",
  ];

  if (rounds.length === 0) {
    lines.push("_No rounds recorded yet._");
  } else {
    lines.push("| # | Story | Estimate | Votes |", "| --- | --- | --- | --- |");
    rounds.forEach((round, index) => {
      const story = (round.story || "Untitled story")
        .replace(/\|/g, "\\|")
        .replace(/\r?\n/g, " ");
      const votes = round.votes
        .map((vote) => `${vote.username}: ${vote.value}`)
        .join(", ")
        .replace(/\|/g, "\\|");
      lines.push(
        `| ${index + 1} | ${story} | ${round.estimate ?? "—"} | ${votes || "—"} |`
      );
    });
  }

  lines.push("", `_Exported from r8ro · ${session.slug}_`, "");
  return lines.join("\n");
}
