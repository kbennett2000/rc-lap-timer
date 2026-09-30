"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createDataStore } from "./index";
import { DataStoreError, type DataStore } from "./types";

const DataStoreContext = createContext<DataStore | null>(null);

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Tab switches reuse data this fresh; coming back to the app always reloads it, so changes made on another
        // phone show up.
        staleTime: 30_000,
        refetchOnWindowFocus: "always",
        // The Pi's Wi-Fi has no internet, and a phone may then report itself offline, which would pause everything.
        networkMode: "always",
        // Only a store that couldn't be reached is worth asking again.
        retry: (failures, error) => failures < 1 && error instanceof DataStoreError && error.kind === "unavailable",
      },
      mutations: { networkMode: "always", retry: false },
    },
  });
}

// Gives the screens the data store and a shared cache of what it holds. Created once per page, never at module
// scope, so server renders never share a cache.
export function DataProvider({ children, store: givenStore }: { children: ReactNode; store?: DataStore }) {
  const [store] = useState(() => givenStore ?? createDataStore());
  const [queryClient] = useState(createQueryClient);
  return (
    <DataStoreContext.Provider value={store}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </DataStoreContext.Provider>
  );
}

export function useDataStore(): DataStore {
  const store = useContext(DataStoreContext);
  if (!store) throw new Error("useDataStore must be used inside a DataProvider");
  return store;
}
