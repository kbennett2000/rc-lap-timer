import { UNSAVED_SESSIONS_KEY } from "@/features/practice/use-unsaved-sessions";
import { ACTIVE_RUN_KEY } from "@/timing/active-run-store";

// Why a restore or a sync can't start now, if it can't: it changes the data a running or unsaved session refers to.
// `what` finishes the sentence: "Finish the running session before restoring a backup."
export function changeBlocker(what: string): string | null {
  try {
    if (localStorage.getItem(ACTIVE_RUN_KEY)) return `Finish the running session before ${what}.`;
    const unsaved = JSON.parse(localStorage.getItem(UNSAVED_SESSIONS_KEY) ?? "[]");
    if (Array.isArray(unsaved) && unsaved.length > 0) {
      return `Save or discard the unsaved sessions at the top of the Practice screen before ${what}.`;
    }
  } catch {
    // Storage blocked: nothing can be running either.
  }
  return null;
}
