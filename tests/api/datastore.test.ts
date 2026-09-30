// The DataStore and BackupStore contracts, run against the Pi's API. Needs the running server described in
// api.test.ts.

import { createApiDataStore } from "@/data/api-data-store";
import { describeBackupStore } from "../datastore/backup-conformance";
import { describeDataStore } from "../datastore/conformance";

const makeStore = () => createApiDataStore({ baseUrl: process.env.API_BASE_URL ?? "http://127.0.0.1:3100" });

describeDataStore("the Pi's API", makeStore);
describeBackupStore("the Pi's API", makeStore);
