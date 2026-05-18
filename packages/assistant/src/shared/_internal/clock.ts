export type AssistantClockHandle = {
  cancel(): void;
};

export type AssistantClock = {
  now(): number;
  setTimeout(fn: () => void, ms: number): AssistantClockHandle;
};
