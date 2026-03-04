import { useTimer } from "../hooks/useTimer";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

export function MainWindow() {
  const { status, config, isLoading, errorMsg, start, pause, reset, updateConfig } = useTimer();

  // 最小化到托盘
  const minimizeToTray = async () => {
    const window = getCurrentWebviewWindow();
    if (window) {
      await window.hide();
    }
  };

  if (errorMsg) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-900 to-red-800 flex-col gap-4 p-8 text-center">
        <div className="text-white text-xl font-bold">加载失败</div>
        <div className="text-red-200 bg-black/30 p-4 rounded text-sm w-full max-w-2xl text-left font-mono break-all whitespace-pre-wrap">{errorMsg}</div>
        <button onClick={() => window.location.reload()} className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 rounded text-white transition">重试</button>
      </div>
    );
  }

  if (isLoading || !status || !config) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-white text-lg">加载中...</div>
      </div>
    );
  }

  const stateText = {
    idle: "空闲",
    working: "工作中",
    resting: "休息中",
    paused: "已暂停",
  };

  const progress = ((status.total - status.remaining) / status.total) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8">
      {/* 标题栏 */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Rest Reminder
        </h1>
        <button
          onClick={minimizeToTray}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          title="最小化到托盘"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
      </div>

      {/* 状态显示 */}
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 mb-6">
        <div className="text-center">
          <div className="text-6xl font-mono font-bold mb-4">
            {Math.floor(status.remaining / 60)
              .toString()
              .padStart(2, "0")}
            :{(status.remaining % 60).toString().padStart(2, "0")}
          </div>
          <div className="text-xl text-gray-300 mb-6">
            {stateText[status.state]}
          </div>

          {/* 进度条 */}
          <div className="w-full bg-white/20 rounded-full h-3 mb-6">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* 控制按钮 */}
          <div className="flex justify-center gap-4">
            {status.state === "idle" || status.state === "paused" ? (
              <button
                onClick={start}
                className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg font-semibold text-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg hover:shadow-green-500/25"
              >
                开始
              </button>
            ) : (
              <button
                onClick={pause}
                className="px-8 py-3 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-lg font-semibold text-lg hover:from-yellow-600 hover:to-orange-700 transition-all shadow-lg hover:shadow-yellow-500/25"
              >
                暂停
              </button>
            )}
            <button
              onClick={reset}
              className="px-8 py-3 bg-gradient-to-r from-gray-600 to-gray-700 rounded-lg font-semibold text-lg hover:from-gray-700 hover:to-gray-800 transition-all"
            >
              重置
            </button>
          </div>
        </div>
      </div>

      {/* 设置区域 */}
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 space-y-6">
        <h2 className="text-xl font-semibold mb-4">设置</h2>

        {/* 工作时长 */}
        <div>
          <label className="block text-sm text-gray-300 mb-2">
            工作时长: {config.work_duration} 分钟
          </label>
          <input
            type="range"
            min="1"
            max="120"
            value={config.work_duration}
            onChange={(e) =>
              updateConfig({
                ...config,
                work_duration: parseInt(e.target.value),
              })
            }
            className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>1分钟</span>
            <span>120分钟</span>
          </div>
        </div>

        {/* 休息时长 */}
        <div>
          <label className="block text-sm text-gray-300 mb-2">
            休息时长: {config.rest_duration} 分钟
          </label>
          <input
            type="range"
            min="1"
            max="30"
            value={config.rest_duration}
            onChange={(e) =>
              updateConfig({
                ...config,
                rest_duration: parseInt(e.target.value),
              })
            }
            className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>1分钟</span>
            <span>30分钟</span>
          </div>
        </div>

        {/* 提示音 */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="enable-sound"
            checked={config.enable_sound}
            onChange={(e) =>
              updateConfig({
                ...config,
                enable_sound: e.target.checked,
              })
            }
            className="w-5 h-5 rounded accent-blue-500 cursor-pointer"
          />
          <label htmlFor="enable-sound" className="cursor-pointer">
            启用提示音
          </label>
        </div>
      </div>
    </div>
  );
}
