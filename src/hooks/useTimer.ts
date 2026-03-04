import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { TimerStatus, TimerConfig } from "../types/timer";

export function useTimer() {
  const [status, setStatus] = useState<TimerStatus | null>(null);
  const [config, setConfig] = useState<TimerConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadState();
    loadConfig();

    // 监听计时器更新事件
    const unlistenTimer = listen<TimerStatus>("timer-update", (event) => {
      setStatus(event.payload);
    });

    // 监听工作完成事件
    const unlistenWork = listen("work-complete", () => {
      showReminderWindow();
    });

    // 监听休息完成事件
    const unlistenRest = listen("rest-complete", () => {
      // 休息完成后不再自动开始工作，而是显示工作提醒弹窗
      showReminderWindow();
    });

    return () => {
      unlistenTimer.then(f => f());
      unlistenWork.then(f => f());
      unlistenRest.then(f => f());
    };
  }, []);

  const loadState = async () => {
    try {
      const state = await invoke<TimerStatus>("get_state");
      setStatus(state);
    } catch (error) {
      console.error("Failed to load timer state:", error);
      setErrorMsg(String(error));
    } finally {
      setIsLoading(false);
    }
  };

  const loadConfig = async () => {
    try {
      const cfg = await invoke<TimerConfig>("get_config");
      setConfig(cfg);
    } catch (error) {
      console.error("Failed to load config:", error);
      setErrorMsg(String(error));
    }
  };

  const start = async () => {
    await invoke("start_timer");
  };

  const pause = async () => {
    await invoke("pause_timer");
  };

  const reset = async () => {
    await invoke("reset_timer");
  };

  const updateConfig = async (newConfig: TimerConfig) => {
    await invoke("save_config", { config: newConfig });
    await invoke("set_config", { config: newConfig });
    setConfig(newConfig);
  };

  const showReminderWindow = async () => {
    await invoke("show_reminder_window");
  };

  const closeReminderWindow = async () => {
    await invoke("close_reminder_window");
  };

  const startRest = async () => {
    await closeReminderWindow();
    await invoke("start_rest");
  };

  const skipRest = async () => {
    await closeReminderWindow();
    await invoke("skip_rest");
  };

  return {
    status,
    config,
    isLoading,
    errorMsg,
    start,
    pause,
    reset,
    updateConfig,
    showReminderWindow,
    closeReminderWindow,
    startRest,
    skipRest,
  };
}
