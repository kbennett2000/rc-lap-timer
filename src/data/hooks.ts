"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import type { Bundle } from "@/domain/sync/bundle";
import type { MotionSettings } from "@/domain/types";
import * as patch from "./cache-patches";
import { toAppData, type AppData } from "./cache-patches";
import { useDataStore } from "./provider";
import {
  DataStoreError,
  isBackupStore,
  type BackupStore,
  type CarChanges,
  type DataStore,
  type MotionSettingsInput,
  type NewCar,
} from "./types";

export type { AppData };

// The shared data is cached under these keys: one snapshot of drivers, locations and sessions, and the saved motion
// settings. A change invalidates its key, which reloads it everywhere it's shown.
export const DATA_KEY = ["data"] as const;
export const MOTION_SETTINGS_KEY = ["motion-settings"] as const;

const EMPTY_DATA: AppData = { drivers: [], locations: [], sessions: [] };
const NO_MOTION_SETTINGS: MotionSettings[] = [];

// Drivers (with their cars), locations and saved sessions, shared by every screen. Empty until the first load.
function useAppDataQuery() {
  const store = useDataStore();
  return useQuery({ queryKey: DATA_KEY, queryFn: async () => toAppData(await store.loadSnapshot()) });
}

export function useAppData(): AppData {
  return useAppDataQuery().data ?? EMPTY_DATA;
}

export const useDrivers = () => useAppData().drivers;
export const useLocations = () => useAppData().locations;
export const useSessions = () => useAppData().sessions;

function useMotionSettingsQuery() {
  const store = useDataStore();
  return useQuery({ queryKey: MOTION_SETTINGS_KEY, queryFn: () => store.listMotionSettings() });
}

export function useMotionSettings(): MotionSettings[] {
  return useMotionSettingsQuery().data ?? NO_MOTION_SETTINGS;
}

// Changes whenever the stored data might have: each time the shared data is loaded or changed.
export function useDataVersion(): number {
  return useAppDataQuery().dataUpdatedAt + useMotionSettingsQuery().dataUpdatedAt;
}

// Reloads the shared data, resolving once the new data is in: for steps that need the very latest drivers and cars.
export function useRefreshData(): () => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(() => queryClient.refetchQueries({ queryKey: DATA_KEY }), [queryClient]);
}

// What to tell the user when a change fails.
export function errorMessage(error: unknown): string {
  return error instanceof DataStoreError ? error.message : "Something went wrong. Please try again.";
}

// A change made through the store. Once the store has it, the cache is patched so every screen shows it at once
// (a new driver can be selected straight away), then reloaded in the background to pick up whatever else it touched.
// Callers await mutateAsync and act on the result there: mutate() callbacks are dropped if the caller unmounts.
function useChange<Args, Result, Cached>(
  key: QueryKey,
  run: (store: DataStore, args: Args) => Promise<Result>,
  apply: (cached: Cached, result: Result, args: Args) => Cached,
) {
  const store = useDataStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: Args) => run(store, args),
    onSuccess: async (result, args) => {
      // A reload that started before the change could land after the patch and undo it.
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<Cached>(key, (cached) => (cached === undefined ? cached : apply(cached, result, args)));
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

interface Rename {
  id: string;
  name: string;
}

export const useCreateDriver = () =>
  useChange(
    DATA_KEY,
    (store, name: string) => store.createDriver(name),
    (data: AppData, driver) => patch.addDriver(data, driver),
  );

export const useRenameDriver = () =>
  useChange(
    DATA_KEY,
    (store, { id, name }: Rename) => store.renameDriver(id, name),
    (data: AppData, _result, { id, name }) => patch.renameDriver(data, id, name.trim()),
  );

export const useDeleteDriver = () =>
  useChange(
    DATA_KEY,
    (store, id: string) => store.deleteDriver(id),
    (data: AppData, _result, id) => patch.removeDriver(data, id),
  );

export const useCreateCar = () =>
  useChange(
    DATA_KEY,
    (store, car: NewCar) => store.createCar(car),
    (data: AppData, car) => patch.addCar(data, car),
  );

export const useUpdateCar = () =>
  useChange(
    DATA_KEY,
    (store, { id, changes }: { id: string; changes: CarChanges }) => store.updateCar(id, changes),
    (data: AppData, _result, { id, changes }) => patch.updateCar(data, id, { ...changes, name: changes.name.trim() }),
  );

export const useDeleteCar = () =>
  useChange(
    DATA_KEY,
    (store, id: string) => store.deleteCar(id),
    (data: AppData, _result, id) => patch.removeCar(data, id),
  );

export const useCreateLocation = () =>
  useChange(
    DATA_KEY,
    (store, name: string) => store.createLocation(name),
    (data: AppData, location) => patch.addLocation(data, location),
  );

export const useRenameLocation = () =>
  useChange(
    DATA_KEY,
    (store, { id, name }: Rename) => store.renameLocation(id, name),
    (data: AppData, _result, { id, name }) => patch.renameLocation(data, id, name.trim()),
  );

export const useDeleteLocation = () =>
  useChange(
    DATA_KEY,
    (store, id: string) => store.deleteLocation(id),
    (data: AppData, _result, id) => patch.removeLocation(data, id),
  );

export const useUpdateSessionNotes = () =>
  useChange(
    DATA_KEY,
    (store, { id, notes }: { id: string; notes: string | null }) => store.updateSessionNotes(id, notes),
    (data: AppData, _result, { id, notes }) => patch.setSessionNotes(data, id, notes),
  );

export const useDeleteSession = () =>
  useChange(
    DATA_KEY,
    (store, id: string) => store.deleteSession(id),
    (data: AppData, _result, id) => patch.removeSession(data, id),
  );

export const useCreateMotionSettings = () =>
  useChange(
    MOTION_SETTINGS_KEY,
    (store, input: MotionSettingsInput) => store.createMotionSettings(input),
    (list: MotionSettings[], created) => patch.addMotionSettings(list, created),
  );

export const useUpdateMotionSettings = () =>
  useChange(
    MOTION_SETTINGS_KEY,
    (store, { id, input }: { id: string; input: MotionSettingsInput }) => store.updateMotionSettings(id, input),
    (list: MotionSettings[], _result, { id, input }) =>
      patch.updateMotionSettings(list, id, { ...input, name: input.name.trim() }),
  );

export const useDeleteMotionSettings = () =>
  useChange(
    MOTION_SETTINGS_KEY,
    (store, id: string) => store.deleteMotionSettings(id),
    (list: MotionSettings[], _result, id) => patch.removeMotionSettings(list, id),
  );

// --- Backups (the phone-only app, where the data lives on the phone) ---

export const LAST_BACKUP_KEY = ["last-backup"] as const;

// The store's backups, or null where the data lives elsewhere (on the Pi).
export function useBackupStore(): (DataStore & BackupStore) | null {
  const store = useDataStore();
  return isBackupStore(store) ? store : null;
}

// When the last backup was saved: null if never, undefined until known.
export function useLastBackup(): string | null | undefined {
  const store = useBackupStore();
  const { data } = useQuery({
    queryKey: LAST_BACKUP_KEY,
    queryFn: () => store!.lastBackupAt(),
    enabled: store !== null,
  });
  return data;
}

export function useMarkBackedUp() {
  const store = useBackupStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (at: string) => {
      await store!.markBackedUp(at);
      return at;
    },
    onSuccess: (at) => queryClient.setQueryData(LAST_BACKUP_KEY, at),
  });
}

// Merges a backup into the app, then reloads everything it may have changed.
export function useRestoreBackup() {
  const store = useBackupStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bundle: Bundle) => store!.importBundle(bundle),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: DATA_KEY }),
        queryClient.invalidateQueries({ queryKey: MOTION_SETTINGS_KEY }),
      ]);
    },
  });
}
