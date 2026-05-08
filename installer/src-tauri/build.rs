fn main() {
    // The Tauri NSIS bundle uses installMode: "perMachine" which triggers
    // UAC for the install. NSIS launches this binary as a child process,
    // so it inherits the elevated token. icacls calls in src/acl.rs run
    // inside that elevation context; no embedded manifest needed.
    //
    // Earlier attempts to add a winres-embedded manifest collided with
    // tauri-winres (which tauri-build uses internally to embed VERSIONINFO),
    // producing CVT1100 duplicate-resource linker errors. Removed.
    tauri_build::build()
}
