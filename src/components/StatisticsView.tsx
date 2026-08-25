import type { TimerConfig, TimerState, TimerStats, TimerStatus } from "../types/timer";

interface StatisticsViewProps {
  stats: TimerStats;
  status: TimerStatus;
  config: TimerConfig;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  if (minutes < 60) return `${minutes} 分`;

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes === 0 ? `${hours} 小时` : `${hours} 小时 ${restMinutes} 分`;
}

function formatTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(restSeconds).padStart(2, "0")}`;
}

function stateLabel(state: TimerState): string {
  switch (state) {
    case "working":
      return "工作中";
    case "resting":
      return "休息中";
    case "snoozing":
      return "延后提醒";
    case "paused":
      return "已暂停";
    case "idle":
      return "待开始";
  }
}

function FocusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="2" fill="currentColor" />
      <path d="M10 1.75v2M10 16.25v2M1.75 10h2M16.25 10h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CycleIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 7.25A6.5 6.5 0 0 1 15.4 5.1M16 3.5v3.75h-3.75M16 12.75A6.5 6.5 0 0 1 4.6 14.9M4 16.5v-3.75h3.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RestIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 6v4l2.75 1.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SnoozeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 3v2M4.9 5.1l1.4 1.4M3 10h2M4.9 14.9l1.4-1.4M15.1 5.1l-1.4 1.4M17 10h-2M15.1 14.9l-1.4-1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="10" r="3.25" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function StatisticsView({ stats, status, config }: StatisticsViewProps) {
  const progress = status.total > 0
    ? Math.min(1, Math.max(0, (status.total - status.remaining) / status.total))
    : 0;
  const completionRate = stats.completed_work_sessions > 0
    ? Math.min(100, Math.round((stats.completed_rest_sessions / stats.completed_work_sessions) * 100))
    : 0;

  const cards = [
    {
      className: "stat-card-focus",
      icon: <FocusIcon />,
      label: "今日专注",
      value: formatDuration(stats.total_focus_seconds),
      note: "已完成工作时段",
    },
    {
      className: "stat-card-cycle",
      icon: <CycleIcon />,
      label: "完成轮次",
      value: stats.completed_work_sessions.toLocaleString("zh-CN"),
      note: "工作时段",
    },
    {
      className: "stat-card-rest",
      icon: <RestIcon />,
      label: "今日休息",
      value: formatDuration(stats.total_rest_seconds),
      note: `${stats.completed_rest_sessions.toLocaleString("zh-CN")} 次完整休息`,
    },
    {
      className: "stat-card-snooze",
      icon: <SnoozeIcon />,
      label: "延后提醒",
      value: stats.snoozed_count.toLocaleString("zh-CN"),
      note: "5 分钟延后次数",
    },
  ];

  return (
    <section className="stats-view" aria-labelledby="statsTitle">
      <div className="stats-heading">
        <div>
          <p className="stats-kicker">今日数据</p>
          <h1 id="statsTitle">统计概览</h1>
        </div>
        <span className="stats-live"><span aria-hidden="true" />实时</span>
      </div>

      <div className="stats-grid">
        {cards.map((card) => (
          <article className={`stat-card ${card.className}`} key={card.label}>
            <div className="stat-card-label">
              <span className="stat-icon">{card.icon}</span>
              <span>{card.label}</span>
            </div>
            <strong>{card.value}</strong>
            <span className="stat-card-note">{card.note}</span>
          </article>
        ))}
      </div>

      <section className="stats-panel current-plan" aria-labelledby="currentPlanTitle">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker">当前状态</p>
            <h2 id="currentPlanTitle">{stateLabel(status.state)}</h2>
          </div>
          <strong>{Math.round(progress * 100)}%</strong>
        </div>
        <div className="stats-progress" aria-hidden="true">
          <span style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="plan-meta">
          <span>{formatTime(status.remaining)} 剩余</span>
          <span>工作 {config.work_duration} 分 · 休息 {config.rest_duration} 分</span>
        </div>
      </section>

      <section className="stats-panel rhythm-panel" aria-labelledby="rhythmTitle">
        <div className="panel-heading panel-heading-compact">
          <div>
            <p className="panel-kicker">节奏概览</p>
            <h2 id="rhythmTitle">工作与休息</h2>
          </div>
        </div>
        <div className="metric-list">
          <div className="metric-row">
            <span>工作时长</span>
            <strong>{config.work_duration} 分钟</strong>
          </div>
          <div className="metric-row">
            <span>休息时长</span>
            <strong>{config.rest_duration} 分钟</strong>
          </div>
          <div className="metric-row">
            <span>休息完成率</span>
            <strong>{completionRate}%</strong>
          </div>
        </div>
      </section>
    </section>
  );
}
