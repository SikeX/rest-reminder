import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { TimerConfig, TimerStats, TimerStatus } from "../types/timer";

export function useTimer() {
  const [status, setStatus] = useState<TimerStatus | null>(null);
  const [config, setConfig] = useState<TimerConfig | null>(null);
  const [stats, setStats] = useState<TimerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadState();
    loadConfig();
    loadStats();

    // 计时状态由后端 timer loop 推送；提醒窗的显示/定位也由后端负责
    //（show-reminder / show-work-reminder + place_reminder_bottom_right）。
    const unlistenTimer = listen<TimerStatus>("timer-update", (event) => {
      setStatus(event.payload);
    });
    const unlistenStats = listen<TimerStats>("stats-update", (event) => {
      setStats(event.payload);
    });

    return () => {
      unlistenTimer.then((f) => f());
      unlistenStats.then((f) => f());
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

  const loadStats = async () => {
    try {
      const currentStats = await invoke<TimerStats>("get_stats");
      setStats(currentStats);
    } catch (error) {
      console.error("Failed to load timer stats:", error);
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

  return {
    status,
    config,
    stats,
    isLoading,
    errorMsg,
    start,
    pause,
    reset,
    updateConfig,
    showReminderWindow,
    closeReminderWindow,
    startRest,
  };
}
