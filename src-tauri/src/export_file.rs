use std::fs;
use std::path::PathBuf;

fn downloads_dir() -> Result<PathBuf, String> {
    let home = std::env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| "Could not find the home directory".to_string())?;
    Ok(home.join("Downloads"))
}

fn safe_filename(filename: &str) -> String {
    let sanitized: String = filename
        .chars()
        .map(|ch| match ch {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
            _ => ch,
        })
        .collect();
    let trimmed = sanitized.trim();
    if trimmed.is_empty() {
        "timeline-export.mp4".to_string()
    } else if trimmed.ends_with(".mp4") {
        trimmed.to_string()
    } else {
        format!("{trimmed}.mp4")
    }
}

fn unique_path(mut path: PathBuf) -> PathBuf {
    if !path.exists() {
        return path;
    }

    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("timeline-export")
        .to_string();
    let ext = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("mp4")
        .to_string();
    let parent = path.parent().map(PathBuf::from).unwrap_or_default();

    for index in 1..1000 {
        let candidate = parent.join(format!("{stem}-{index}.{ext}"));
        if !candidate.exists() {
            return candidate;
        }
        path = candidate;
    }

    path
}

#[tauri::command]
pub fn save_export_to_downloads(filename: String, bytes: Vec<u8>) -> Result<String, String> {
    let dir = downloads_dir()?;
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    let path = unique_path(dir.join(safe_filename(&filename)));
    fs::write(&path, bytes).map_err(|error| error.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}
