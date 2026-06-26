mod commands;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::import::import_photos,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hoarder's Little Helper");
}
