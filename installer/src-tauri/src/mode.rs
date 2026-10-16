//! Decides whether this start of the exe installs or uninstalls.
//!
//! The same binary is shipped as `HardwaveSuite-Setup.exe` and copied into
//! the install folder as `Hardwave Suite Uninstaller.exe`. Windows does not
//! always start the uninstaller with the exact `--uninstall` argument (a
//! double-click or a shortcut passes nothing), so the file name counts too:
//! an exe whose name contains "uninstall" never shows the install screens.

use std::path::Path;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Mode {
    Install,
    Uninstall { quiet: bool },
}

/// `args` are the command-line arguments without the program name;
/// `exe_path` is the path of the running executable, if known.
pub fn decide<S: AsRef<str>>(args: &[S], exe_path: Option<&Path>) -> Mode {
    let uninstall = args.iter().any(|a| is_flag(a.as_ref(), "uninstall"))
        || exe_path
            .and_then(Path::file_name)
            .map(|n| {
                n.to_string_lossy()
                    .to_ascii_lowercase()
                    .contains("uninstall")
            })
            .unwrap_or(false);

    if uninstall {
        Mode::Uninstall {
            quiet: args.iter().any(|a| is_flag(a.as_ref(), "quiet")),
        }
    } else {
        Mode::Install
    }
}

/// True for `--name`, `/name` or `-name`, in any case.
fn is_flag(arg: &str, name: &str) -> bool {
    let bare = arg
        .strip_prefix("--")
        .or_else(|| arg.strip_prefix('/'))
        .or_else(|| arg.strip_prefix('-'));
    bare.is_some_and(|b| b.eq_ignore_ascii_case(name))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    const NO_ARGS: &[&str] = &[];

    fn uninstaller() -> PathBuf {
        PathBuf::from(
            r"C:\Users\me\AppData\Local\Programs\Hardwave Suite\Hardwave Suite Uninstaller.exe",
        )
    }

    fn installer() -> PathBuf {
        PathBuf::from(r"C:\Users\me\Downloads\HardwaveSuite-Setup.exe")
    }

    #[test]
    fn uninstaller_name_without_arguments_uninstalls() {
        assert_eq!(
            decide(NO_ARGS, Some(&uninstaller())),
            Mode::Uninstall { quiet: false }
        );
    }

    #[test]
    fn double_dash_uninstall_argument_uninstalls() {
        assert_eq!(
            decide(&["--uninstall"], Some(&installer())),
            Mode::Uninstall { quiet: false }
        );
    }

    #[test]
    fn slash_uninstall_argument_in_any_case_uninstalls() {
        assert_eq!(
            decide(&["/Uninstall"], Some(&installer())),
            Mode::Uninstall { quiet: false }
        );
        assert_eq!(
            decide(&["-UNINSTALL"], Some(&installer())),
            Mode::Uninstall { quiet: false }
        );
    }

    #[test]
    fn installer_name_without_arguments_installs() {
        assert_eq!(decide(NO_ARGS, Some(&installer())), Mode::Install);
        assert_eq!(decide(NO_ARGS, None), Mode::Install);
    }

    #[test]
    fn uninstaller_name_matches_in_any_case() {
        let exe = PathBuf::from(r"C:\x\HARDWAVE SUITE UNINSTALLER.EXE");
        assert_eq!(
            decide(NO_ARGS, Some(&exe)),
            Mode::Uninstall { quiet: false }
        );
    }

    #[test]
    fn quiet_argument_uninstalls_without_a_window() {
        assert_eq!(
            decide(&["--uninstall", "--quiet"], Some(&uninstaller())),
            Mode::Uninstall { quiet: true }
        );
        assert_eq!(
            decide(&["--uninstall", "--quiet"], Some(&installer())),
            Mode::Uninstall { quiet: true }
        );
        assert_eq!(
            decide(&["/QUIET"], Some(&uninstaller())),
            Mode::Uninstall { quiet: true }
        );
    }

    #[test]
    fn quiet_alone_does_not_uninstall() {
        assert_eq!(decide(&["--quiet"], Some(&installer())), Mode::Install);
    }

    #[test]
    fn unrelated_arguments_do_not_uninstall() {
        assert_eq!(
            decide(&["--uninstaller", "uninstall"], Some(&installer())),
            Mode::Install
        );
    }
}
