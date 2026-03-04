import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

export function ReminderWindow() {
  const [visible, setVisible] = useState(false);
  const [isWorkReminder, setIsWorkReminder] = useState(false);

  useEffect(() => {
    // 监听显示休息提醒事件
    const unlistenRest = listen("show-reminder", () => {
      setIsWorkReminder(false);
      setVisible(true);
    });

    // 监听显示工作提醒事件
    const unlistenWork = listen("show-work-reminder", () => {
      setIsWorkReminder(true);
      setVisible(true);
    });

    return () => {
      unlistenRest.then(f => f());
      unlistenWork.then(f => f());
    };
  }, []);

  const handleStartRest = async () => {
    await invoke("start_rest");
    const window = getCurrentWebviewWindow();
    await window.hide();
    setVisible(false);
  };

  const handleStartWork = async () => {
    await invoke("start_timer");
    const window = getCurrentWebviewWindow();
    await window.hide();
    setVisible(false);
  };

  const handleSkip = async () => {
    if (isWorkReminder) {
      // 如果是工作提醒，稍后提醒意思是暂时不开始计时，直接关掉即可
      const window = getCurrentWebviewWindow();
      await window.hide();
      setVisible(false);
    } else {
      await invoke("skip_rest");
      const window = getCurrentWebviewWindow();
      await window.hide();
      setVisible(false);
    }
  };

  if (!visible) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-transparent">
        <div className="text-gray-400 text-sm">等待提醒...</div>
      </div>
    );
  }

  return (
    <div className={
      `min-h-screen flex items-center justify-center p-8 bg-gradient-to-r ${isWorkReminder ? 'from-orange-500 to-red-500' : 'from-blue-600 to-purple-600'}`
    }>
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
        {/* 图标 */}
        <div className="mb-6 flex justify-center">
          <div className={
            `w-20 h-20 rounded-full flex items-center justify-center bg-gradient-to-r ${isWorkReminder ? 'from-orange-400 to-red-400' : 'from-blue-500 to-purple-500'}`
          }>
            {isWorkReminder ? (
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            ) : (
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </div>
        </div>

        {/* 标题 */}
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          {isWorkReminder ? "该工作了！" : "该休息了！"}
        </h1>
        <p className="text-gray-600 mb-8">
          {isWorkReminder ? "休息时间结束，现在是时候继续专注工作了。" : "你已经完成了一段时间的工作，现在是时候放松一下眼睛和身体了。"}
        </p>

        {/* 按钮 */}
        <div className="space-y-3">
          <button
            onClick={isWorkReminder ? handleStartWork : handleStartRest}
            className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-semibold text-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg hover:shadow-green-500/25"
          >
            {isWorkReminder ? "开始工作" : "开始休息"}
          </button>
          <button
            onClick={handleSkip}
            className="w-full py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-semibold text-lg hover:bg-gray-50 transition-all"
          >
            稍后提醒
          </button>
        </div>

        {/* 提示 */}
        <p className="text-xs text-gray-400 mt-6">
          {isWorkReminder ? '点击"开始工作"将开始倒计时' : '点击"开始休息"将开始倒计时，完成后会自动提醒继续工作'}
        </p>
      </div>
    </div>
  );
}
