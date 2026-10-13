# Signing the Windows build

The Suite is signed with Azure Trusted Signing, the same account and the same script as the DAW
(`hardwave-daw/docs/CODE_SIGNING.md` has the full story, including how the account was made).

What this repository has:

- `scripts/sign-windows.ps1`: the signing script. Tauri runs it on every file it bundles
  (`bundle.windows.signCommand` in `src-tauri/tauri.conf.json`); the release workflow runs it once
  more on `HardwaveSuite-Setup.exe`, which is built with `--no-bundle`.
- Repository variables, set: `AZURE_TRUSTED_SIGNING_ENDPOINT`, `AZURE_TRUSTED_SIGNING_ACCOUNT`,
  `AZURE_TRUSTED_SIGNING_PROFILE`.
- Repository secrets, to set once from the same values the DAW repository has:
  `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`.

On a release tag (`v*`) a missing setting or a signature that does not check out stops the build:
nothing ships unsigned. A manual run without the settings builds unsigned and says so in the log.
