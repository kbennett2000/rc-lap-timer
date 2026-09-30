import { useRef } from "react";

// A ref that always holds the latest value, for callbacks (timers, camera frames) that outlive a render.
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
