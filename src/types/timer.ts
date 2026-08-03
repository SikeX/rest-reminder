export type TimerState = "idle" | "working" | "resting" | "snoozing" | "paused";

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

export interface TimerStats {
  total_focus_seconds: number;
  total_rest_seconds: number;
  completed_work_sessions: number;
  completed_rest_sessions: number;
  snoozed_count: number;
}
