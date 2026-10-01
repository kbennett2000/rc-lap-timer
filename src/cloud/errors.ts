// What went wrong talking to the cloud service, in words for the person using the app. Supabase reports problems as
// error objects (from sign-in) or { error, status } results (from the database), with an HTTP status (0 when nothing
// answered) and often a code.

export type CloudProblem =
  | "offline"
  | "unavailable"
  | "bad-code"
  | "too-many"
  | "bad-email"
  | "no-signups"
  | "signed-out"
  | "busy"
  | "update-app"
  | "invalid"
  | "track-taken"
  | "track-in-use"
  | "not-yours";

const MESSAGES: Record<CloudProblem, string> = {
  offline:
    "Couldn't reach the cloud service. Check this phone's internet connection (the timer's Wi-Fi has none), then try again.",
  unavailable: "The cloud service isn't answering right now. Try again later.",
  "bad-code": "That code is wrong or has expired. Check it, or send a new code.",
  "too-many": "Too many tries. Wait a few minutes, then try again.",
  "bad-email": "The cloud service doesn't accept that email address.",
  "no-signups": "This cloud service isn't taking new accounts.",
  "signed-out": "You've been signed out. Sign in again.",
  busy: "Another device was syncing with your account at the same time. Try again.",
  "update-app": "Your account's data was saved by a newer version of the app. Reload the app to update it.",
  invalid: "The data in your account can't be read. Nothing was changed on this phone.",
  "track-taken": "There's already a track with that name and area. Choose it from the list, or add where it is.",
  "track-in-use": "Other people have laps on this track, so it can't be deleted.",
  "not-yours": "Only whoever added a track can change it.",
};

export class CloudError extends Error {
  constructor(
    readonly problem: CloudProblem,
    message = MESSAGES[problem],
  ) {
    super(message);
    this.name = "CloudError";
  }
}

interface Reported {
  status?: number;
  code?: string;
  name?: string;
}

function field(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null && key in value
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

export function cloudProblem(error: unknown, status?: number): CloudProblem {
  if (error instanceof CloudError) return error.problem;
  const reported: Reported = {
    status: status ?? (typeof field(error, "status") === "number" ? (field(error, "status") as number) : undefined),
    code: typeof field(error, "code") === "string" ? (field(error, "code") as string) : undefined,
    name: typeof field(error, "name") === "string" ? (field(error, "name") as string) : undefined,
  };
  const code = reported.code ?? "";
  if (code === "otp_expired") return "bad-code";
  if (reported.status === 429 || code.includes("rate_limit")) return "too-many";
  if (code === "email_address_invalid" || code === "validation_failed") return "bad-email";
  if (code === "signup_disabled" || code === "email_provider_disabled" || code === "otp_disabled") return "no-signups";
  if (
    reported.status === 401 ||
    ["session_not_found", "refresh_token_not_found", "bad_jwt", "user_not_found", "PGRST301", "PGRST303"].includes(code)
  ) {
    return "signed-out";
  }
  if (code === "PT409") return "busy";
  // Nothing answered: offline, or the request never got out.
  if (
    reported.status === 0 ||
    error instanceof TypeError ||
    (reported.name === "AuthRetryableFetchError" && !reported.status)
  ) {
    return "offline";
  }
  return "unavailable";
}

export function toCloudError(error: unknown, status?: number): CloudError {
  return error instanceof CloudError ? error : new CloudError(cloudProblem(error, status));
}
