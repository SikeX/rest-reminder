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
    elapsed: u64,
    total: u64,
    cycle_count: u32,
    start_time: Option<Instant>,
    paused_elapsed: u64,
}

impl Timer {
    pub fn new(config: TimerConfig) -> Self {
        let total = config.work_duration * 60;
        Self {
            state: TimerState::Idle,
            config,
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
        if self.cycle_count % 2 == 0 {
            self.total = self.config.work_duration * 60;
        } else {
            self.total = self.config.rest_duration * 60;
        }
    }

    pub fn start_rest(&mut self) {
        self.state = TimerState::Resting;
        self.elapsed = 0;
        self.total = self.config.rest_duration * 60;
        self.start_time = Some(Instant::now());
        self.paused_elapsed = 0;
    }

    pub fn skip_rest(&mut self) {
        self.state = TimerState::Working;
        self.elapsed = 0;
        self.total = self.config.work_duration * 60;
        self.start_time = Some(Instant::now());
        self.paused_elapsed = 0;
    }

    pub fn set_config(&mut self, config: TimerConfig) {
        if self.state == TimerState::Idle {
            self.total = config.work_duration * 60;
        }
        self.config = config;
    }

    pub fn update(&mut self) -> Option<TimerStateChange> {
        if let Some(start) = self.start_time {
            self.elapsed = self.paused_elapsed + start.elapsed().as_secs();

            if self.elapsed >= self.total {
                return match self.state {
                    TimerState::Working => {
                        self.cycle_count += 1;
                        self.state = TimerState::Idle;
                        self.elapsed = 0;
                        self.paused_elapsed = 0;
                        self.start_time = None;
                        Some(TimerStateChange::WorkComplete)
                    }
                    TimerState::Resting => {
                        self.state = TimerState::Working;
                        self.elapsed = 0;
                        self.paused_elapsed = 0;
                        self.total = self.config.work_duration * 60;
                        self.start_time = Some(Instant::now());
                        Some(TimerStateChange::RestComplete)
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

    pub fn get_state(&self) -> TimerState {
        self.state
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TimerStateChange {
    WorkComplete,
    RestComplete,
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
        let mut t = timer.lock().await;
        
        // Always emit timer status if Working or Resting
        let state = t.state;
        if state == TimerState::Working || state == TimerState::Resting {
            let status = t.get_status();
            use tauri::Emitter;
            let _ = app.emit("timer-update", &status);
        }

        if let Some(change) = t.update() {
            let _ = tx.send(change).await;
        }
    }
}
