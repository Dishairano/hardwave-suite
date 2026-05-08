fn main() {
    // Embed the Windows manifest so the installer EXE triggers UAC and runs
    // elevated. We need elevation to write ACLs on system plug-in folders
    // (Common Files\VST3 and \CLAP) — see src/acl.rs.
    //
    // Use a custom .rc file that embeds ONLY the RT_MANIFEST resource.
    // winres's default `set_manifest_file` path also emits a VERSIONINFO
    // block, which collides with the one Tauri's build pipeline embeds —
    // manifesting as a CVT1100 "duplicate resource" linker error on
    // Windows (broke v0.18.1 / v0.19.0 / v0.20.0 release builds).
    // Pointing winres at our manifest-only manifest.rc bypasses winres's
    // auto-generated VERSIONINFO and leaves the Tauri version block alone.
    #[cfg(target_os = "windows")]
    {
        let mut res = winres::WindowsResource::new();
        res.set_resource_file("manifest.rc");
        res.compile().expect("Failed to embed Windows manifest");
    }

    tauri_build::build()
}
