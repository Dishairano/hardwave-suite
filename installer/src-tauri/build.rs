fn main() {
    // Embed the Windows manifest so the installer EXE triggers UAC and runs
    // elevated. We need elevation to write ACLs on system plug-in folders
    // (Common Files\VST3 and \CLAP) — see src/acl.rs.
    #[cfg(target_os = "windows")]
    {
        let mut res = winres::WindowsResource::new();
        res.set_manifest_file("manifest.xml");
        res.compile().expect("Failed to embed Windows manifest");
    }

    tauri_build::build()
}
