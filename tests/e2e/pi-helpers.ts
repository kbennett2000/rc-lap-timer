// Shared by the Pi's browser tests.

import { expect, test } from "@playwright/test";

// Fails a test when the timer refuses one of its own pages' requests as coming from another site (403), using a method
// the route doesn't take (405) or not being JSON (415): the sign of app code that sends a write the old way, as a GET or
// without a JSON body (see refuseWrite in src/lib/api-helpers.ts).
export function expectNoRefusedRequests() {
  let refused: string[] = [];
  test.beforeEach(({ page }) => {
    refused = [];
    page.on("response", (response) => {
      const { pathname } = new URL(response.url());
      if (pathname.startsWith("/api/") && [403, 405, 415].includes(response.status())) {
        refused.push(`${response.request().method()} ${pathname}: ${response.status()}`);
      }
    });
  });
  test.afterEach(() => {
    expect(refused, "requests the timer refused").toEqual([]);
  });
}
