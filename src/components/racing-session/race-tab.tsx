"use client";

import { RaceHistory } from "./race-history";
import { RacingSession } from "./index";

// The Race tab's content, loaded on its own when the tab is first opened (see lap-timer.tsx).
export default function RaceTab() {
  return (
    <>
      <RacingSession />
      <RaceHistory />
    </>
  );
}
