// The DataStore contract, run against the Pi's API. Needs the running server described in api.test.ts.

import { createApiDataStore } from "@/data/api-data-store";
import { describeDataStore } from "../datastore/conformance";

describeDataStore("the Pi's API", () =>
  createApiDataStore({ baseUrl: process.env.API_BASE_URL ?? "http://127.0.0.1:3100" }),
);
