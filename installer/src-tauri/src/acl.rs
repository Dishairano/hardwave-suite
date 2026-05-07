//! Windows ACL helpers — grant the current user Modify rights on system
//! plug-in folders so the (non-elevated) Suite app can write there at runtime
//! without triggering UAC. Called once during install while the installer is
//! still elevated.
//!
//! Why this exists:
//!   The installer EXE is manifested with `requireAdministrator` and the NSIS
//!   bundle is configured `installMode: perMachine`, so the user accepts a
//!   single UAC prompt when launching the .exe. We use that elevation window
//!   to permanently widen the ACLs on `C:\Program Files\Common Files\VST3`
//!   and `\CLAP` so the Suite — running as a normal-privilege user — can
//!   write plug-in payloads to those system paths without ever triggering
//!   UAC again.

#[cfg(windows)]
pub fn grant_user_acl_on_system_paths() -> Result<(), String> {
    // The installer is running elevated, but USERPROFILE / HOMEDRIVE still
    // resolve to the *original* user's home dir (unless the user explicitly
    // ran the installer from another account). `whoami` would return the
    // elevated identity (often "Administrator") which is the wrong principal
    // to grant rights to.
    let user = std::env::var("USERPROFILE")
        .ok()
        .and_then(|p| {
            std::path::PathBuf::from(p)
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
        })
        .ok_or_else(|| "Could not derive original username from USERPROFILE".to_string())?;

    let paths = [
        r"C:\Program Files\Common Files\VST3",
        r"C:\Program Files\Common Files\CLAP",
    ];

    for path in paths {
        // Create the directory if it doesn't exist — we're admin, this is safe.
        // Errors here are non-fatal: if the dir already exists we'll proceed
        // straight to the icacls grant.
        let _ = std::fs::create_dir_all(path);

        // Grant Modify (M) recursively, with object/container inheritance so
        // any plug-in subfolder the Suite drops in inherits the same ACL.
        //   /grant <user>:(OI)(CI)(M)  — object-inherit + container-inherit + modify
        //   /T                          — apply recursively to existing children
        //   /Q                          — quiet (suppress per-object success spam)
        let output = std::process::Command::new("icacls")
            .arg(path)
            .arg("/grant")
            .arg(format!("{}:(OI)(CI)(M)", user))
            .arg("/T")
            .arg("/Q")
            .output()
            .map_err(|e| format!("icacls invocation failed: {}", e))?;

        if !output.status.success() {
            return Err(format!(
                "icacls on {} failed: {}",
                path,
                String::from_utf8_lossy(&output.stderr).trim()
            ));
        }
    }

    Ok(())
}

#[cfg(not(windows))]
pub fn grant_user_acl_on_system_paths() -> Result<(), String> {
    // No-op on non-Windows: VST3/CLAP system paths are a Windows concept here.
    // Keeping the signature identical so callers compile cleanly.
    Ok(())
}
