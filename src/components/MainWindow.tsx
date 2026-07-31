import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTimer } from "../hooks/useTimer";
import type { TimerConfig, TimerState, TimerStatus } from "../types/timer";

const RING_CIRC = 2 * Math.PI * 44; // r=44

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function paintRange(input: HTMLInputElement | null) {
  if (!input) return;
  const min = Number(input.min) || 0;
  const max = Number(input.max) || 100;
  const val = Number(input.value);
  const pct = max === min ? 0 : ((val - min) / (max - min)) * 100;
  const fill = "color-mix(in oklch, var(--fg) 28%, var(--border))";
  input.style.background = `linear-gradient(to right, ${fill} 0%, ${fill} ${pct}%, var(--border) ${pct}%, var(--border) 100%)`;
}

function modeMeta(status: TimerStatus): {
  pillClass: string;
  modeText: string;
  caption: string;
  ringClass: string;
  isRestVisual: boolean;
} {
  const { state } = status;
  if (state === "working") {
    return {
      pillClass: "is-work",
      modeText: "工作中",
      caption: "工作倒计时",
      ringClass: "",
      isRestVisual: false,
    };
  }
  if (state === "resting") {
    return {
      pillClass: "is-rest",
      modeText: "休息中",
      caption: "休息倒计时",
      ringClass: "is-rest",
      isRestVisual: true,
    };
  }
  if (state === "paused") {
    return {
      pillClass: "is-work",
      modeText: "已暂停",
      caption: "已暂停",
      ringClass: "",
      isRestVisual: false,
    };
  }
  return {
    pillClass: "is-idle",
    modeText: "待开始",
    caption: "设定工作时长",
    ringClass: "is-idle",
    isRestVisual: false,
  };
}

function progressLabel(state: TimerState, progress: number): string {
  if (state === "idle") return "准备就绪";
  return `进度 ${Math.round(progress * 100)}%`;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M4 2.5v11l9-5.5-9-5.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="3.5" y="2.5" width="3.5" height="11" rx="0.5" />
      <rect x="9" y="2.5" width="3.5" height="11" rx="0.5" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M3 8a5 5 0 0 1 8.5-3.5M13 3v3.5H9.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 8a5 5 0 0 1-8.5 3.5M3 13v-3.5H6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MainWindow() {
  const {
    status,
    config,
    isLoading,
    errorMsg,
    start,
    pause,
    reset,
    updateConfig,
  } = useTimer();

  const workRangeRef = useRef<HTMLInputElement>(null);
  const restRangeRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const lastAnnounce = useRef("");

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    paintRange(workRangeRef.current);
    paintRange(restRangeRef.current);
  }, [config?.work_duration, config?.rest_duration]);

  useEffect(() => {
    if (!status) return;
    let text = "";
    if (status.state === "working") text = "工作中";
    else if (status.state === "resting") text = "休息中";
    else if (status.state === "paused") text = "已暂停";
    else if (status.state === "idle") text = "待开始";
    if (text && text !== lastAnnounce.current) {
      lastAnnounce.current = text;
    }
  }, [status?.state]);

  const handlePrimary = async () => {
    if (!status) return;
    if (status.state === "idle" || status.state === "paused") {
      await start();
    } else if (status.state === "working" || status.state === "resting") {
      await pause();
    }
  };

  const handleReset = async () => {
    await reset();
    showToast("已重置");
  };

  const handleConfigChange = async (partial: Partial<TimerConfig>) => {
    if (!config) return;
    const next = { ...config, ...partial };
    await updateConfig(next);
  };

  const meta = useMemo(() => (status ? modeMeta(status) : null), [status]);

  const progress = useMemo(() => {
    if (!status || status.total <= 0) return 0;
    return Math.min(1, Math.max(0, (status.total - status.remaining) / status.total));
  }, [status]);

  const dashOffset = RING_CIRC * (1 - progress);

  if (errorMsg) {
    return (
      <div className="state-screen" role="alert">
        <h2>无法连接计时服务</h2>
        <p>请确认通过 Tauri 启动本应用。浏览器直接打开无法调用后端接口。</p>
        <div className="error-box">{errorMsg}</div>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          重试
        </button>
      </div>
    );
  }

  if (isLoading || !status || !config || !meta) {
    return (
      <div className="state-screen" aria-busy="true">
        <h2>加载中…</h2>
        <p>正在同步计时状态</p>
      </div>
    );
  }

  const isRunning = status.state === "working" || status.state === "resting";
  const primaryLabel = isRunning ? "暂停" : status.state === "paused" ? "继续" : "开始";
  const settingsLocked = status.state !== "idle";
  const resetDisabled = status.state === "idle";
  const hintText =
    status.state === "resting"
      ? "休息进行中"
      : isRunning
        ? "专注进行中"
        : "工作结束后将从右下角弹出提醒";

  return (
    <div className="app-shell" aria-label="Rest Reminder 主窗口">
      <div className="main-body">
        <div className="mode-row">
          <div
            className={`mode-pill ${meta.pillClass}`}
            role="status"
            aria-live="polite"
          >
            <span className="dot" aria-hidden="true" />
            <span>{meta.modeText}</span>
          </div>
          <div className="session-meta">
            {status.cycle_count <= 0 ? "尚未开始" : `第 ${status.cycle_count} 轮`}
          </div>
        </div>

        <div className="timer-block">
          <div
            className={`ring-wrap ${meta.ringClass}`}
            role="img"
            aria-label={`${meta.caption} ${formatTime(status.remaining)}`}
          >
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <circle className="ring-track" cx="50" cy="50" r="44" />
              <circle
                className="ring-prog"
                cx="50"
                cy="50"
                r="44"
                strokeDasharray={RING_CIRC}
                strokeDashoffset={dashOffset}
              />
            </svg>
            <div className="ring-center">
              <div className="time-display">{formatTime(status.remaining)}</div>
              <div className="time-caption">{meta.caption}</div>
            </div>
          </div>
          <div className="progress-pct" aria-hidden="true">
            {progressLabel(status.state, progress)}
          </div>
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {lastAnnounce.current}
          </div>
        </div>

        <div className="controls">
          <button
            type="button"
            className={`btn btn-primary${meta.isRestVisual && isRunning ? " is-rest-mode" : ""}`}
            onClick={handlePrimary}
            aria-label={primaryLabel}
          >
            {isRunning ? <PauseIcon /> : <PlayIcon />}
            <span>{primaryLabel}</span>
          </button>
          <button
            type="button"
            className="btn"
            onClick={handleReset}
            disabled={resetDisabled}
            aria-label="重置计时"
          >
            <ResetIcon />
            重置
          </button>
        </div>

        <div className="settings">
          <div className="setting-row">
            <label className="setting-label" htmlFor="workRange">
              工作
            </label>
            <div className="range-wrap">
              <input
                ref={workRangeRef}
                type="range"
                id="workRange"
                min={5}
                max={90}
                step={5}
                value={config.work_duration}
                disabled={settingsLocked}
                aria-valuetext={`${config.work_duration} 分钟`}
                onChange={(e) => {
                  paintRange(e.currentTarget);
                  void handleConfigChange({ work_duration: Number(e.target.value) });
                }}
              />
            </div>
            <span className="setting-val" aria-hidden="true">
              {config.work_duration} 分
            </span>
          </div>

          <div className="setting-row">
            <label className="setting-label" htmlFor="restRange">
              休息
            </label>
            <div className="range-wrap">
              <input
                ref={restRangeRef}
                type="range"
                id="restRange"
                min={1}
                max={30}
                step={1}
                value={config.rest_duration}
                disabled={settingsLocked}
                aria-valuetext={`${config.rest_duration} 分钟`}
                onChange={(e) => {
                  paintRange(e.currentTarget);
                  void handleConfigChange({ rest_duration: Number(e.target.value) });
                }}
              />
            </div>
            <span className="setting-val" aria-hidden="true">
              {config.rest_duration} 分
            </span>
          </div>

          <div className="toggle-row">
            <div className="toggle-label" id="soundLabel">
              <strong>提示音</strong>
              <span>到点时播放轻提示</span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                id="soundToggle"
                checked={config.enable_sound}
                aria-labelledby="soundLabel"
                onChange={(e) => {
                  void handleConfigChange({ enable_sound: e.target.checked });
                }}
              />
              <span className="switch-track" aria-hidden="true" />
            </label>
          </div>
        </div>

        <p className="app-hint">{hintText}</p>
      </div>

      <div
        className={`toast${toast ? " show" : ""}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {toast}
      </div>
    </div>
  );
}
