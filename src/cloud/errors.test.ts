import { describe, expect, it } from "vitest";
import { CloudError, cloudProblem, toCloudError } from "./errors";

describe("cloudProblem", () => {
  it("reads sign-in errors by their code", () => {
    expect(cloudProblem({ name: "AuthApiError", status: 403, code: "otp_expired" })).toBe("bad-code");
    expect(cloudProblem({ name: "AuthApiError", status: 429, code: "over_email_send_rate_limit" })).toBe("too-many");
    expect(cloudProblem({ name: "AuthApiError", status: 400, code: "email_address_invalid" })).toBe("bad-email");
    expect(cloudProblem({ name: "AuthApiError", status: 422, code: "signup_disabled" })).toBe("no-signups");
    expect(cloudProblem({ name: "AuthApiError", status: 403, code: "session_not_found" })).toBe("signed-out");
  });

  it("reads database errors by their code and the response's status", () => {
    expect(cloudProblem({ code: "PT409", message: "conflict" }, 409)).toBe("busy");
    expect(cloudProblem({ code: "PGRST303", message: "JWT expired" }, 401)).toBe("signed-out");
    expect(cloudProblem({ code: "42501", message: "permission denied" }, 401)).toBe("signed-out");
    expect(cloudProblem({ code: "", message: "Service Unavailable" }, 503)).toBe("unavailable");
  });

  it("tells being offline from the service not answering", () => {
    expect(cloudProblem({ code: "", message: "TypeError: Failed to fetch" }, 0)).toBe("offline");
    expect(cloudProblem(new TypeError("Failed to fetch"))).toBe("offline");
    expect(cloudProblem({ name: "AuthRetryableFetchError", status: 0 })).toBe("offline");
    expect(cloudProblem({ name: "AuthRetryableFetchError", status: 503 })).toBe("unavailable");
    expect(cloudProblem("something odd")).toBe("unavailable");
  });

  it("keeps a CloudError as it is", () => {
    const error = new CloudError("update-app");
    expect(toCloudError(error)).toBe(error);
    expect(toCloudError({ status: 429 })).toMatchObject({
      problem: "too-many",
      message: expect.stringMatching(/wait/i),
    });
  });
});
