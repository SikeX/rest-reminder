use crate::timer::{SharedTimer, TimerConfig, TimerStatus};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_store::StoreBuilder;

#[tauri::command]
pub async fn start_timer(
    timer: State<'_, SharedTimer>,
    app: AppHandle,
) -> Result<TimerStatus, String> {
    let mut t = timer.lock().await;
    t.start();
    let status = t.get_status();
    app.emit("timer-update", &status).map_err(|e| e.to_string())?;
    Ok(status)
}

#[tauri::command]
pub async fn pause_timer(
    timer: State<'_, SharedTimer>,
    app: AppHandle,
) -> Result<TimerStatus, String> {
    let mut t = timer.lock().await;
    t.pause();
    let status = t.get_status();
    app.emit("timer-update", &status).map_err(|e| e.to_string())?;
    Ok(status)
}

#[tauri::command]
pub async fn reset_timer(
    timer: State<'_, SharedTimer>,
    app: AppHandle,
) -> Result<TimerStatus, String> {
    let mut t = timer.lock().await;
    t.reset();
    let status = t.get_status();
    app.emit("timer-update", &status).map_err(|e| e.to_string())?;
    Ok(status)
}

#[tauri::command]
pub async fn get_state(timer: State<'_, SharedTimer>) -> Result<TimerStatus, String> {
    let t = timer.lock().await;
    Ok(t.get_status())
}

#[tauri::command]
pub async fn set_config(
    timer: State<'_, SharedTimer>,
    config: TimerConfig,
) -> Result<(), String> {
    let mut t = timer.lock().await;
    t.set_config(config);
    Ok(())
}

#[tauri::command]
pub async fn get_config(timer: State<'_, SharedTimer>) -> Result<TimerConfig, String> {
    let t = timer.lock().await;
    Ok(t.get_config())
}

#[tauri::command]
pub async fn start_rest(
    timer: State<'_, SharedTimer>,
    app: AppHandle,
) -> Result<TimerStatus, String> {
    let mut t = timer.lock().await;
    t.start_rest();
    let status = t.get_status();
    app.emit("timer-update", &status).map_err(|e| e.to_string())?;
    Ok(status)
}

#[tauri::command]
pub async fn skip_rest(
    timer: State<'_, SharedTimer>,
    app: AppHandle,
) -> Result<TimerStatus, String> {
    let mut t = timer.lock().await;
    t.skip_rest();
    let status = t.get_status();
    app.emit("timer-update", &status).map_err(|e| e.to_string())?;
    Ok(status)
}

#[tauri::command]
pub async fn close_reminder_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("reminder") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn show_reminder_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("reminder") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn save_config(app: AppHandle, config: TimerConfig) -> Result<(), String> {
    let store = StoreBuilder::new(&app, "config.json").build()
        .map_err(|e| e.to_string())?;
    store.set("work_duration", config.work_duration);
    store.set("rest_duration", config.rest_duration);
    store.set("enable_sound", config.enable_sound);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}
