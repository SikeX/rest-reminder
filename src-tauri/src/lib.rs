mod commands;
mod timer;

use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_store::StoreBuilder;
use tokio::sync::Mutex;
use timer::{run_timer_loop, SharedTimer, Timer, TimerConfig, TimerStateChange};

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

            // 创建计时器
            let timer = Timer::new(config.clone());
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

            tauri::async_runtime::spawn(async move {
                while let Some(change) = rx.recv().await {
                    match change {
                        TimerStateChange::WorkComplete => {
                            log::info!("Work complete, showing reminder");
                            // Emit show-reminder event to frontend so React state shows the UI
                            use tauri::Emitter;
                            let _ = app_handle.emit("show-reminder", ());

                            if let Some(window) = app_handle.get_webview_window("reminder") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            } else {
                                // 如果窗口不存在，则创建它
                                let _ = tauri::WebviewWindowBuilder::new(&app_handle, "reminder", tauri::WebviewUrl::App("index.html".parse().unwrap()))
                                    .title("提醒")
                                    .inner_size(400.0, 550.0)
                                    .min_inner_size(400.0, 550.0)
                                    .resizable(false)
                                    .always_on_top(true)
                                    .decorations(false)
                                    .center()
                                    .visible(true)
                                    .skip_taskbar(true)
                                    .build();
                            }
                        }
                        TimerStateChange::RestComplete => {
                            log::info!("Rest complete, showing work reminder");
                            use tauri::Emitter;
                            let _ = app_handle.emit("show-work-reminder", ());
                            
                            if let Some(window) = app_handle.get_webview_window("reminder") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            } else {
                                let _ = tauri::WebviewWindowBuilder::new(&app_handle, "reminder", tauri::WebviewUrl::App("index.html".parse().unwrap()))
                                    .title("提醒")
                                    .inner_size(400.0, 550.0)
                                    .min_inner_size(400.0, 550.0)
                                    .resizable(false)
                                    .always_on_top(true)
                                    .decorations(false)
                                    .center()
                                    .visible(true)
                                    .skip_taskbar(true)
                                    .build();
                            }
                        }
                    }
                }
            });


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
            commands::set_config,
            commands::get_config,
            commands::start_rest,
            commands::skip_rest,
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
