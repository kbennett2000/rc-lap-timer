// Shows a message on the Remote LED display: POST {title?, message}. The display shows "Message" when there's no title.
import { badRequest, readJson, refuseWrite } from "@/lib/api-helpers";
import { sendToLed } from "../config";

const MAX_LENGTH = 200;

const isText = (value: unknown): value is string => typeof value === "string" && value.length <= MAX_LENGTH;

export async function POST(request: Request) {
  const refused = refuseWrite(request);
  if (refused) return refused;

  const { title, message } = (await readJson(request)) ?? {};
  if (!isText(message) || (title !== undefined && !isText(title))) {
    return badRequest(`message, and title if there is one, must be text of at most ${MAX_LENGTH} characters`);
  }
  return sendToLed("text", title === undefined ? { message } : { title, message });
}
