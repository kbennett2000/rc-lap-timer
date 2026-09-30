// Plays one of the Remote LED display's patterns (handlePatternGet in remote_led/RemoteLED.cpp): POST {name}.
import { badRequest, readJson, refuseWrite } from "@/lib/api-helpers";
import { sendToLed } from "../config";

const PATTERN_NAME = /^[a-z0-9_-]{1,32}$/;

export async function POST(request: Request) {
  const refused = refuseWrite(request);
  if (refused) return refused;

  const { name } = (await readJson(request)) ?? {};
  if (typeof name !== "string" || !PATTERN_NAME.test(name)) return badRequest("name must be the name of a pattern");
  return sendToLed("pattern", { name });
}
