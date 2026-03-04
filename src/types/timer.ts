export type TimerState = "idle" | "working" | "resting" | "paused";

export interface TimerStatus {
  state: TimerState;
  elapsed: number;
  remaining: number;
  total: number;
  cycle_count: number;
}

export interface TimerConfig {
  work_duration: number;
  rest_duration: number;
  enable_sound: boolean;
}
