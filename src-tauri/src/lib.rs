mod commands;
mod timer;

use std::sync::Arc;
use tauri::{Manager, PhysicalPosition, Position, WebviewWindow};
use tauri_plugin_store::StoreBuilder;
use tokio::sync::Mutex;
use timer::{run_timer_loop, SharedTimer, Timer, TimerConfig, TimerStats, TimerStateChange};

/// Place the reminder window at the bottom-right of the primary work area
/// (above the Windows taskbar / macOS dock). Prefer primary monitor so a
/// still-hidden window does not fall back to a wrong/centered position.
pub fn place_reminder_bottom_right(window: &WebviewWindow) {
    const MARGIN: i32 = 16;

    let monitor = window
        .primary_monitor()
        .ok()
        .flatten()
        .or_else(|| window.current_monitor().ok().flatten());

    let Some(monitor) = monitor else {
        log::warn!("place_reminder: no monitor available");
        return;
    };

    let Ok(outer) = window.outer_size() else {
        log::warn!("place_reminder: outer_size failed");
        return;
    };

    // work_area excludes the taskbar/dock; values are physical pixels.
    let work = monitor.work_area();
    let area_x = work.position.x;
    let area_y = work.position.y;
    let area_w = work.size.width as i32;
    let area_h = work.size.height as i32;
    let win_w = outer.width as i32;
    let win_h = outer.height as i32;

    if area_w <= 0 || area_h <= 0 || win_w <= 0 || win_h <= 0 {
        log::warn!(
            "place_reminder: invalid sizes area={}x{} win={}x{}",
            area_w,
            area_h,
            win_w,
            win_h
        );
        return;
    }

    let x = (area_x + area_w - win_w - MARGIN).max(area_x);
    let y = (area_y + area_h - win_h - MARGIN).max(area_y);

    if let Err(err) = window.set_position(Position::Physical(PhysicalPosition::new(x, y))) {
        log::warn!("place_reminder: set_position failed: {err}");
    } else {
        log::info!("place_reminder: moved to physical ({x}, {y}) on work area {area_w}x{area_h}");
    }
}

/// Show the reminder window at bottom-right; create it if missing.
/// Uses the system title bar (`decorations: true`) — never a mocked traffic-light bar.
pub fn show_reminder(app: &tauri::AppHandle, title: &str) {
    if let Some(window) = app.get_webview_window("reminder") {
        let _ = window.set_title(title);
        // Position while still hidden, show, then re-place once decorations
        // contribute to outer_size. A short delayed re-place covers Windows DPI races.
        place_reminder_bottom_right(&window);
        let _ = window.show();
        let _ = window.unminimize();
        place_reminder_bottom_right(&window);
        let _ = window.set_focus();

        let delayed = window.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(50));
            place_reminder_bottom_right(&delayed);
            let _ = delayed.set_focus();
        });
        return;
    }

    let built = tauri::WebviewWindowBuilder::new(
        app,
        "reminder",
        tauri::WebviewUrl::App("index.html".parse().unwrap()),
    )
    .title(title)
    .inner_size(360.0, 220.0)
    .min_inner_size(320.0, 180.0)
    .resizable(false)
    .always_on_top(true)
    .decorations(true)
    .visible(true)
    .skip_taskbar(true)
    .build();

    if let Ok(window) = built {
        place_reminder_bottom_right(&window);
        let _ = window.set_focus();
        let delayed = window.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(50));
            place_reminder_bottom_right(&delayed);
        });
    }
}

fn load_stats(store: &tauri_plugin_store::Store<tauri::Wry>) -> TimerStats {
    TimerStats {
        total_focus_seconds: store
            .get("total_focus_seconds")
            .and_then(|value| value.as_u64())
            .unwrap_or(0),
        total_rest_seconds: store
            .get("total_rest_seconds")
            .and_then(|value| value.as_u64())
            .unwrap_or(0),
        completed_work_sessions: store
            .get("completed_work_sessions")
            .and_then(|value| value.as_u64())
            .unwrap_or(0) as u32,
        completed_rest_sessions: store
            .get("completed_rest_sessions")
            .and_then(|value| value.as_u64())
            .unwrap_or(0) as u32,
        snoozed_count: store
            .get("snoozed_count")
            .and_then(|value| value.as_u64())
            .unwrap_or(0) as u32,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // 加载配置
            let store = StoreBuilder::new(app.handle(), "config.json").build()?;
            let config: TimerConfig = if store.get("work_duration").is_some() {
                TimerConfig {
                    work_duration: store.get("work_duration").unwrap().as_u64().unwrap_or(25),
                    rest_duration: store.get("rest_duration").unwrap().as_u64().unwrap_or(5),
                    enable_sound: store.get("enable_sound").unwrap().as_bool().unwrap_or(true),
                }
            } else {
                TimerConfig::default()
            };

            // 保存默认配置
            store.set("work_duration", config.work_duration);
            store.set("rest_duration", config.rest_duration);
            store.set("enable_sound", config.enable_sound);
            let _ = store.save();

            let stats = load_stats(&store);

            // 创建计时器
            let timer = Timer::new(config.clone(), stats);
            let shared_timer: SharedTimer = Arc::new(Mutex::new(timer));
            app.manage(shared_timer.clone());

            // 启动计时器循环
            let timer_clone = shared_timer.clone();
            let app_handle = app.handle().clone();
            let (tx, mut rx) = tokio::sync::mpsc::channel::<TimerStateChange>(32);

            let app_handle_for_timer = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                run_timer_loop(timer_clone, tx, app_handle_for_timer).await;
            });

            let timer_for_events = shared_timer.clone();
            tauri::async_runtime::spawn(async move {
                while let Some(change) = rx.recv().await {
                    let stats = {
                        let t = timer_for_events.lock().await;
                        t.get_stats()
                    };
                    if let Err(error) = commands::persist_stats(&app_handle, &stats) {
                        log::warn!("Failed to persist timer stats: {error}");
                    }
                    use tauri::Emitter;
                    let _ = app_handle.emit("stats-update", &stats);

                    match change {
                        TimerStateChange::WorkComplete => {
                            log::info!("Work complete, showing reminder at bottom-right");
                            use tauri::Emitter;
                            // Emit first so the reminder webview can update copy,
                            // then show + pin to bottom-right of the primary work area.
                            let _ = app_handle.emit("show-reminder", ());
                            show_reminder(&app_handle, "休息提醒");
                        }
                        TimerStateChange::RestComplete => {
                            log::info!("Rest complete, showing work reminder at bottom-right");
                            use tauri::Emitter;
                            let _ = app_handle.emit("show-work-reminder", ());
                            show_reminder(&app_handle, "工作提醒");
                        }
                        TimerStateChange::SnoozeComplete => {
                            log::info!("Snooze complete, showing rest reminder at bottom-right");
                            let _ = app_handle.emit("show-reminder", ());
                            show_reminder(&app_handle, "休息提醒");
                        }
                    }
                }
            });

            // 启动时把预创建的提醒窗放到右下角（仍保持隐藏）
            if let Some(window) = app.get_webview_window("reminder") {
                place_reminder_bottom_right(&window);
            }

            // 设置系统托盘
            setup_tray(app)?;

            Ok(())
        })
        .plugin(tauri_plugin_store::Builder::new().build())
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                if window.label() == "main" {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            commands::start_timer,
            commands::pause_timer,
            commands::reset_timer,
            commands::get_state,
            commands::get_stats,
            commands::set_config,
            commands::get_config,
            commands::start_rest,
            commands::snooze_rest,
            commands::close_reminder_window,
            commands::show_reminder_window,
            commands::save_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::{menu::{Menu, MenuItem}, tray::TrayIconBuilder};

    let show = MenuItem::with_id(app, "show", "显示", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", "隐藏", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &hide, &quit])?;

    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
            "hide" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            "quit" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.close();
                }
                if let Some(window) = app.get_webview_window("reminder") {
                    let _ = window.close();
                }
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::Click {
                button: tauri::tray::MouseButton::Left,
                button_state: tauri::tray::MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
        })
        .icon(app.default_window_icon().unwrap().clone())
        .build(app)?;

    Ok(())
}
