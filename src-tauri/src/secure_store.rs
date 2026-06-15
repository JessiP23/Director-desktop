//! OS-native secure storage for the Supabase session token.
//!
//! Backed by the platform keychain (macOS Keychain / Windows Credential
//! Manager) via the `keyring` crate. Exposed to the frontend as the
//! `secure_get` / `secure_set` / `secure_delete` Tauri commands, consumed by
//! `src/lib/tauri/secure-store.ts`.

use keyring::{Entry, Error as KeyringError};

const SERVICE: &str = "com.jessipavia.director-desktop";

fn entry(key: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn secure_get(key: String) -> Result<Option<String>, String> {
    match entry(&key)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn secure_set(key: String, value: String) -> Result<(), String> {
    entry(&key)?.set_password(&value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn secure_delete(key: String) -> Result<(), String> {
    match entry(&key)?.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
