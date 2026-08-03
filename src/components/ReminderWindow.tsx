import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

/**
 * Dedicated reminder webview. Window visibility is owned by Tauri
 * (`show` / `hide` + bottom-right placement). This component always
 * renders product content — no mock Mac title bar, system chrome only.
 */
export function ReminderWindow() {
  const [isWorkReminder, setIsWorkReminder] = useState(false);
  const [snoozeNote, setSnoozeNote] = useState("");
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const win = getCurrentWebviewWindow();

    // Recover type from window title if the event was missed (show race).
    void win.title().then((t) => {
      if (t.includes("工作")) setIsWorkReminder(true);
      else if (t.includes("休息")) setIsWorkReminder(false);
    });

    const unlistenRest = listen("show-reminder", () => {
      setIsWorkReminder(false);
      setSnoozeNote("");
    });

    const unlistenWork = listen("show-work-reminder", () => {
      setIsWorkReminder(true);
      setSnoozeNote("");
    });

    return () => {
      unlistenRest.then((f) => f());
      unlistenWork.then((f) => f());
    };
  }, []);

  // Focus primary action when this webview is shown/focused.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      primaryRef.current?.focus({ preventScroll: true });
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        void handleSkip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWorkReminder]);

  const hideWindow = async () => {
    const win = getCurrentWebviewWindow();
    await win.hide();
  };

  const handleStartRest = async () => {
    await invoke("start_rest");
    await hideWindow();
  };

  const handleStartWork = async () => {
    await invoke("start_timer");
    await hideWindow();
  };

  const handleSkip = async () => {
    if (isWorkReminder) {
      await hideWindow();
    } else {
      setSnoozeNote("5 分钟后再次提醒");
      await invoke("snooze_rest");
      await hideWindow();
    }
  };

  const title = isWorkReminder ? "该继续工作了" : "该休息一下了";
  const desc = isWorkReminder
    ? "休息时间结束。站起来活动后，可以开始下一轮专注。"
    : "你已专注完成一轮工作，站起来活动几分钟会更好。";
  const primaryLabel = isWorkReminder ? "开始工作" : "开始休息";
  const secondaryLabel = "稍后 · 5 分";

  return (
    <div
      className={`reminder-shell${isWorkReminder ? " is-work" : ""}`}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="reminderTitle"
      aria-describedby="reminderDesc"
    >
      <div className="reminder-body">
        <div className="reminder-top">
          <div
            className={`reminder-icon${isWorkReminder ? " is-work" : ""}`}
            aria-hidden="true"
          >
            {isWorkReminder ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="7" width="18" height="13" rx="2" />
                <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <path d="M3 12h18" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            )}
          </div>
          <div className="reminder-copy">
            <h2 id="reminderTitle">{title}</h2>
            <p id="reminderDesc">{desc}</p>
          </div>
        </div>

        <div className="reminder-actions">
          <button
            ref={primaryRef}
            type="button"
            className={`btn ${isWorkReminder ? "btn-work" : "btn-rest"}`}
            onClick={isWorkReminder ? handleStartWork : handleStartRest}
          >
            {primaryLabel}
          </button>
          <button type="button" className="btn" onClick={handleSkip}>
            {secondaryLabel}
          </button>
        </div>

        <div className="snooze-note" role="status">
          {snoozeNote}
        </div>
      </div>
    </div>
  );
}
