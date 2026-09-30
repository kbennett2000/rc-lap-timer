// Lap time as mm:ss.mmm.
export function formatLapTime(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = Math.floor(ms % 1000);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
}

// Lap time for speech: "12 point 34" or "1 minute, 2 point 05" (hundredths).
export function formatLapTimeForSpeech(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const hundredths = Math.floor((ms % 1000) / 10)
    .toString()
    .padStart(2, "0");
  if (minutes > 0) return `${minutes} minute${minutes !== 1 ? "s" : ""}, ${seconds} point ${hundredths}`;
  return `${seconds} point ${hundredths}`;
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}
