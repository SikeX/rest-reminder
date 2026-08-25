use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tokio::time::{interval, Instant};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TimerState {
    Idle,
    Working,
    Resting,
    Snoozing,
    Paused,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimerStatus {
    pub state: TimerState,
    pub elapsed: u64,        // 已过秒数
    pub remaining: u64,      // 剩余秒数
    pub total: u64,          // 总秒数
    pub cycle_count: u32,    // 完成的休息次数
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimerConfig {
    pub work_duration: u64,    // 工作时长（分钟）
    pub rest_duration: u64,    // 休息时长（分钟）
    pub enable_sound: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TimerStats {
    pub total_focus_seconds: u64,
    pub total_rest_seconds: u64,
    pub completed_work_sessions: u32,
    pub completed_rest_sessions: u32,
    pub snoozed_count: u32,
    /// 统计归属日期（本地时区，格式 YYYY-MM-DD）；跨天时计数清零
    #[serde(default)]
    pub stats_date: String,
}

pub const SNOOZE_DURATION_SECONDS: u64 = 5 * 60;

impl Default for TimerConfig {
    fn default() -> Self {
        Self {
            work_duration: 25,
            rest_duration: 5,
            enable_sound: true,
        }
    }
}

pub struct Timer {
    state: TimerState,
    config: TimerConfig,
    stats: TimerStats,
    elapsed: u64,
    total: u64,
    cycle_count: u32,
    start_time: Option<Instant>,
    paused_elapsed: u64,
}

impl Timer {
    pub fn new(config: TimerConfig, stats: TimerStats) -> Self {
        let total = config.work_duration * 60;
        Self {
            state: TimerState::Idle,
            config,
            stats,
            elapsed: 0,
            total,
            cycle_count: 0,
            start_time: None,
            paused_elapsed: 0,
        }
    }

    pub fn start(&mut self) {
        if self.state == TimerState::Idle || self.state == TimerState::Paused {
            self.state = TimerState::Working;
            self.elapsed = self.paused_elapsed;
            self.total = self.config.work_duration * 60;
            self.start_time = Some(Instant::now());
            self.paused_elapsed = 0;
        }
    }

    pub fn pause(&mut self) {
        if self.state == TimerState::Working || self.state == TimerState::Resting {
            self.paused_elapsed = self.elapsed;
            self.state = TimerState::Paused;
            self.start_time = None;
        }
    }

    pub fn reset(&mut self) {
        self.state = TimerState::Idle;
        self.elapsed = 0;
        self.paused_elapsed = 0;
        self.start_time = None;
        self.total = self.config.work_duration * 60;
    }

    pub fn start_rest(&mut self) {
        self.state = TimerState::Resting;
        self.elapsed = 0;
        self.total = self.config.rest_duration * 60;
        self.start_time = Some(Instant::now());
        self.paused_elapsed = 0;
    }

    pub fn snooze_rest(&mut self) {
        if self.state != TimerState::Idle {
            return;
        }

        self.state = TimerState::Snoozing;
        self.elapsed = 0;
        self.total = SNOOZE_DURATION_SECONDS;
        self.start_time = Some(Instant::now());
        self.paused_elapsed = 0;
        self.stats.snoozed_count += 1;
    }

    pub fn set_config(&mut self, config: TimerConfig) {
        if self.state == TimerState::Idle {
            self.total = config.work_duration * 60;
        }
        self.config = config;
    }

    /// 按天统计：归属日期不是今天时清空计数，返回是否发生了重置
    pub fn rollover_stats_if_new_day(&mut self, today: &str) -> bool {
        if self.stats.stats_date != today {
            self.stats = TimerStats {
                stats_date: today.to_string(),
                ..Default::default()
            };
            true
        } else {
            false
        }
    }

    pub fn update(&mut self) -> Option<TimerStateChange> {
        if let Some(start) = self.start_time {
            self.elapsed = self.paused_elapsed + start.elapsed().as_secs();

            if self.elapsed >= self.total {
                return match self.state {
                    TimerState::Working => {
                        self.stats.total_focus_seconds += self.total;
                        self.stats.completed_work_sessions += 1;
                        self.cycle_count += 1;
                        self.state = TimerState::Idle;
                        self.elapsed = 0;
                        self.paused_elapsed = 0;
                        self.start_time = None;
                        Some(TimerStateChange::WorkComplete)
                    }
                    TimerState::Resting => {
                        self.stats.total_rest_seconds += self.total;
                        self.stats.completed_rest_sessions += 1;
                        self.state = TimerState::Working;
                        self.elapsed = 0;
                        self.paused_elapsed = 0;
                        self.total = self.config.work_duration * 60;
                        self.start_time = Some(Instant::now());
                        Some(TimerStateChange::RestComplete)
                    }
                    TimerState::Snoozing => {
                        // 延后的时间段仍属于工作，计入当日专注时长
                        self.stats.total_focus_seconds += self.total;
                        self.state = TimerState::Idle;
                        self.elapsed = 0;
                        self.paused_elapsed = 0;
                        self.total = self.config.rest_duration * 60;
                        self.start_time = None;
                        Some(TimerStateChange::SnoozeComplete)
                    }
                    _ => None,
                };
            }
        }
        None
    }

    pub fn get_status(&self) -> TimerStatus {
        let elapsed = self.elapsed.min(self.total);
        TimerStatus {
            state: self.state,
            elapsed,
            remaining: self.total - elapsed,
            total: self.total,
            cycle_count: self.cycle_count,
        }
    }

    pub fn get_config(&self) -> TimerConfig {
        self.config.clone()
    }

    pub fn get_stats(&self) -> TimerStats {
        self.stats.clone()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TimerStateChange {
    WorkComplete,
    RestComplete,
    SnoozeComplete,
}

pub type SharedTimer = Arc<Mutex<Timer>>;

pub async fn run_timer_loop(
    timer: SharedTimer,
    tx: tokio::sync::mpsc::Sender<TimerStateChange>,
    app: tauri::AppHandle,
) {
    let mut interval = interval(Duration::from_secs(1));
    loop {
        interval.tick().await;
        let (status, change, stats_rollover) = {
            let mut t = timer.lock().await;
            // 按天统计：本地日期变化时清空当日计数
            let today = chrono::Local::now().date_naive().to_string();
            let rollover = t.rollover_stats_if_new_day(&today);
            let change = t.update();
            (t.get_status(), change, rollover)
        };

        if stats_rollover || change.is_some() {
            use tauri::Emitter;
            let stats = {
                let t = timer.lock().await;
                t.get_stats()
            };
            let _ = app.emit("stats-update", &stats);
        }

        if status.state == TimerState::Working
            || status.state == TimerState::Resting
            || status.state == TimerState::Snoozing
            || change.is_some()
        {
            use tauri::Emitter;
            let _ = app.emit("timer-update", &status);
        }

        if let Some(change) = change {
            let _ = tx.send(change).await;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn snooze_enters_a_separate_five_minute_state() {
        let mut timer = Timer::new(TimerConfig::default(), TimerStats::default());

        timer.snooze_rest();

        let status = timer.get_status();
        assert_eq!(status.state, TimerState::Snoozing);
        assert_eq!(status.remaining, SNOOZE_DURATION_SECONDS);
        assert_eq!(timer.get_stats().snoozed_count, 1);
    }

    #[test]
    fn stats_reset_on_new_day() {
        let mut stats = TimerStats {
            total_focus_seconds: 3600,
            completed_work_sessions: 3,
            snoozed_count: 2,
            ..Default::default()
        };
        stats.stats_date = "2026-08-24".to_string();
        let mut timer = Timer::new(TimerConfig::default(), stats);

        // 同一天不清零
        assert!(!timer.rollover_stats_if_new_day("2026-08-24"));
        assert_eq!(timer.get_stats().total_focus_seconds, 3600);

        // 跨天清零并记录新日期
        assert!(timer.rollover_stats_if_new_day("2026-08-25"));
        let new_stats = timer.get_stats();
        assert_eq!(new_stats.total_focus_seconds, 0);
        assert_eq!(new_stats.completed_work_sessions, 0);
        assert_eq!(new_stats.snoozed_count, 0);
        assert_eq!(new_stats.stats_date, "2026-08-25");
    }

    #[test]
    fn snooze_completion_counts_toward_focus_time() {
        let mut timer = Timer::new(TimerConfig::default(), TimerStats::default());
        timer.snooze_rest();

        // 模拟 5 分钟延后时间走完
        timer.start_time =
            Some(Instant::now() - Duration::from_secs(SNOOZE_DURATION_SECONDS));
        assert_eq!(timer.update(), Some(TimerStateChange::SnoozeComplete));

        let stats = timer.get_stats();
        assert_eq!(stats.total_focus_seconds, SNOOZE_DURATION_SECONDS);
    }
}
