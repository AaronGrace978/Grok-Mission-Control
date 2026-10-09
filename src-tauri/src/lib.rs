use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use futures_util::StreamExt;
use serde::Serialize;
use serde_json::Value;
use tauri::ipc::Channel;
use tauri::State;

const XAI_BASE: &str = "https://api.x.ai/v1";

#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "lowercase")]
enum StreamEvent {
    Delta { text: String },
    Error { message: String, status: Option<u16> },
    Done,
}

#[derive(Default)]
struct Streams(Mutex<HashMap<String, Arc<AtomicBool>>>);

/// Pulls the text delta out of one SSE `data:` payload for the given endpoint.
fn extract_delta(endpoint: &str, data: &str) -> Result<Option<String>, String> {
    let Ok(v) = serde_json::from_str::<Value>(data) else {
        return Ok(None);
    };
    if endpoint == "chat" {
        if let Some(err) = v.get("error") {
            return Err(err.get("message").and_then(Value::as_str).unwrap_or("stream error").to_string());
        }
        Ok(v.pointer("/choices/0/delta/content").and_then(Value::as_str).map(str::to_owned))
    } else {
        match v.get("type").and_then(Value::as_str) {
            Some("response.output_text.delta") => Ok(v.get("delta").and_then(Value::as_str).map(str::to_owned)),
            Some("error") | Some("response.failed") => Err(v
                .pointer("/error/message")
                .or_else(|| v.get("message"))
                .and_then(Value::as_str)
                .unwrap_or("Responses API failed")
                .to_string()),
            _ => Ok(None),
        }
    }
}

/// Streams an xAI completion and forwards text deltas over a Tauri channel.
/// The request is made from Rust so the webview never needs CORS access to api.x.ai.
#[tauri::command]
async fn grok_stream(
    request_id: String,
    api_key: String,
    endpoint: String,
    body: String,
    on_event: Channel<StreamEvent>,
    streams: State<'_, Streams>,
) -> Result<(), String> {
    let path = match endpoint.as_str() {
        "chat" => "chat/completions",
        "responses" => "responses",
        other => return Err(format!("unknown endpoint: {other}")),
    };
    let cancelled = Arc::new(AtomicBool::new(false));
    streams.0.lock().unwrap().insert(request_id.clone(), cancelled.clone());

    let result = async {
        let client = reqwest::Client::new();
        let res = client
            .post(format!("{XAI_BASE}/{path}"))
            .bearer_auth(api_key.trim())
            .header("Content-Type", "application/json")
            .header("Accept", "text/event-stream")
            .body(body)
            .send()
            .await
            .map_err(|e| format!("Network error reaching api.x.ai: {e}"))?;

        let status = res.status();
        if !status.is_success() {
            let text = res.text().await.unwrap_or_default();
            let _ = on_event.send(StreamEvent::Error { message: text, status: Some(status.as_u16()) });
            return Ok(());
        }

        let mut stream = res.bytes_stream();
        let mut buffer = String::new();
        while let Some(chunk) = stream.next().await {
            if cancelled.load(Ordering::Relaxed) {
                break;
            }
            let chunk = chunk.map_err(|e| format!("Stream interrupted: {e}"))?;
            buffer.push_str(&String::from_utf8_lossy(&chunk).replace("\r\n", "\n"));
            while let Some(idx) = buffer.find("\n\n") {
                let event: String = buffer.drain(..idx + 2).collect();
                let data = event
                    .lines()
                    .filter_map(|l| l.strip_prefix("data:"))
                    .map(str::trim_start)
                    .collect::<Vec<_>>()
                    .join("\n");
                if data.is_empty() || data == "[DONE]" {
                    continue;
                }
                match extract_delta(&endpoint, &data) {
                    Ok(Some(text)) if !text.is_empty() => {
                        let _ = on_event.send(StreamEvent::Delta { text });
                    }
                    Ok(_) => {}
                    Err(message) => {
                        let _ = on_event.send(StreamEvent::Error { message, status: None });
                        return Ok(());
                    }
                }
            }
        }
        let _ = on_event.send(StreamEvent::Done);
        Ok::<(), String>(())
    }
    .await;

    streams.0.lock().unwrap().remove(&request_id);
    result
}

#[tauri::command]
fn grok_cancel(request_id: String, streams: State<'_, Streams>) {
    if let Some(flag) = streams.0.lock().unwrap().get(&request_id) {
        flag.store(true, Ordering::Relaxed);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(Streams::default())
        .invoke_handler(tauri::generate_handler![grok_stream, grok_cancel])
        .run(tauri::generate_context!())
        .expect("error while running Grok Mission Control");
}
