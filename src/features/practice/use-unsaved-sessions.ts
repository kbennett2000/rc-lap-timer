"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DATA_KEY, errorMessage } from "@/data/hooks";
import { useDataStore } from "@/data/provider";
import { DataStoreError } from "@/data/types";
import type { NewSession } from "@/domain/types";
import { logger } from "@/lib/logger";

// Finished sessions are written here before they are sent, and leave only once the server has them. A failed save,
// a lost connection or a page killed mid-save all leave the session here, with Retry save.
export const UNSAVED_SESSIONS_KEY = "rc-lap-timer-unsaved-sessions";
// Old full-data mirrors from earlier versions. They caused deleted sessions to reappear, so they are removed on load.
const LEGACY_STORAGE_KEYS = ["rc-lap-timer-sessions", "rc-lap-timer-drivers"];

// Entries written by older versions may lack some fields.
export type UnsavedSession = Pick<NewSession, "id"> & Partial<NewSession>;

// retryable is false when trying again can't help, for example because the session's driver was deleted.
export type SaveFailure = { ok: false; retryable: boolean; message: string };
export type SaveOutcome = { ok: true } | SaveFailure;

export function useUnsavedSessions() {
  const store = useDataStore();
  const queryClient = useQueryClient();
  const listRef = useRef<UnsavedSession[]>([]);
  const [unsaved, setUnsaved] = useState<UnsavedSession[]>([]);
  // Sessions being sent right now: already written to storage, but not shown as unsaved unless the send fails.
  const [sending, setSending] = useState<ReadonlySet<string>>(new Set());
  const [isRetrying, setIsRetrying] = useState(false);

  const setList = useCallback((next: UnsavedSession[]) => {
    listRef.current = next;
    setUnsaved(next);
    try {
      if (next.length > 0) localStorage.setItem(UNSAVED_SESSIONS_KEY, JSON.stringify(next));
      else localStorage.removeItem(UNSAVED_SESSIONS_KEY);
    } catch (error) {
      logger.error("Could not keep the unsaved sessions in localStorage:", error);
    }
  }, []);

  useEffect(() => {
    try {
      LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
      const pending = JSON.parse(localStorage.getItem(UNSAVED_SESSIONS_KEY) ?? "[]");
      if (Array.isArray(pending) && pending.length > 0) {
        listRef.current = pending;
        setUnsaved(pending);
      }
    } catch (error) {
      logger.error("Error reading unsaved sessions:", error);
    }
  }, []);

  const without = (id: string) => listRef.current.filter((pending) => pending.id !== id);

  // Sends one session. Saving is idempotent: the store ignores an id it already has, so retries are safe.
  const save = useCallback(
    async (session: UnsavedSession): Promise<SaveOutcome> => {
      try {
        // Entries come from localStorage, so they may be incomplete: the store checks them and refuses what it can't save.
        await store.saveSession(session as NewSession);
        setList(without(session.id));
        void queryClient.invalidateQueries({ queryKey: DATA_KEY });
        return { ok: true };
      } catch (error) {
        logger.error("Error saving session:", error);
        if (!listRef.current.some((pending) => pending.id === session.id)) setList([...listRef.current, session]);
        const retryable = !(error instanceof DataStoreError) || error.kind === "unavailable";
        return { ok: false, retryable, message: errorMessage(error) };
      }
    },
    [setList, store, queryClient],
  );

  // Returns the sessions that still failed.
  const retryAll = useCallback(async (): Promise<SaveFailure[]> => {
    setIsRetrying(true);
    const failures: SaveFailure[] = [];
    for (const session of [...listRef.current]) {
      const outcome = await save(session);
      if (!outcome.ok) failures.push(outcome);
    }
    setIsRetrying(false);
    return failures;
  }, [save]);

  // A newly finished session: stored first, then sent.
  const saveNew = useCallback(
    async (session: UnsavedSession): Promise<SaveOutcome> => {
      setList([...without(session.id), session]);
      setSending((ids) => new Set(ids).add(session.id));
      try {
        return await save(session);
      } finally {
        setSending((ids) => {
          const next = new Set(ids);
          next.delete(session.id);
          return next;
        });
      }
    },
    [save, setList],
  );

  const discardAll = useCallback(() => setList([]), [setList]);

  return {
    unsaved: unsaved.filter((session) => !sending.has(session.id)),
    isRetrying,
    saveNew,
    retryAll,
    discardAll,
  };
}
