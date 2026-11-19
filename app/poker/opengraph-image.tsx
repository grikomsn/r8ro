import {
  OG_CONTENT_TYPE,
  OG_SIZE,
  OgFrame,
  PokerCard,
  renderOgImage,
} from "@/lib/og/render";
import { POKER_LANDING } from "@/lib/site";

export const alt = "r8ro: free online planning poker";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const CARDS = ["1", "2", "3", "5", "8", "13", "21", "?"];

export default function Image() {
  return renderOgImage(
    <OgFrame
      eyebrow="Free planning poker · No sign-up"
      subtitle="Votes stay hidden until the host reveals them."
      title={POKER_LANDING.heading}
    >
      <div
        style={{
          display: "flex",
          width: "100%",
          justifyContent: "space-between",
        }}
      >
        {CARDS.map((value) => (
          <PokerCard highlighted={value === "8"} key={value} value={value} />
        ))}
      </div>
    </OgFrame>
  );
}
