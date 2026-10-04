fn main() {
    let commit_count = std::process::Command::new("git")
        .args(["rev-list", "--count", "HEAD"])
        .output()
        .ok()
        .and_then(|out| {
            if out.status.success() {
                String::from_utf8(out.stdout).ok().map(|s| s.trim().to_string())
            } else {
                None
            }
        })
        .or_else(|| std::env::var("GITHUB_RUN_NUMBER").ok())
        .or_else(|| std::env::var("BUILD_NUMBER").ok())
        .unwrap_or_else(|| "1".to_string());

    println!("cargo:rustc-env=ZENTAURI_BUILD_COUNT={}", commit_count);
    tauri_build::build()
}
