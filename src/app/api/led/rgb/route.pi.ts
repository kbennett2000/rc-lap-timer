// Sets the Remote LED display's colour: POST {r, g, b}, each a whole number from 0 to 255.
import { badRequest, readJson, refuseWrite } from "@/lib/api-helpers";
import { sendToLed } from "../config";

const isLevel = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 255;

export async function POST(request: Request) {
  const refused = refuseWrite(request);
  if (refused) return refused;

  const { r, g, b } = (await readJson(request)) ?? {};
  if (!isLevel(r) || !isLevel(g) || !isLevel(b)) return badRequest("r, g and b must be whole numbers from 0 to 255");
  return sendToLed("rgb", { r: String(r), g: String(g), b: String(b) });
}
