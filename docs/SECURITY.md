# Secrets and security policy

This project handles **no user credentials and no third-party API tokens** in normal operation — all compute is local. However, building and shipping signed releases requires a few secrets. This document is the canonical reference for how they are stored.

---

## Hard rules

1. **Plaintext secrets are never committed to git.** No exceptions.
2. **`.env`, `*.key`, `*.pem`, `*.p12`, `*.pfx`, `.tauri/`, `secrets/`** are gitignored at the repo root.
3. **If a secret ever genuinely needs to live in the repo**, it must be encrypted with [`git-crypt`](https://github.com/AGWA/git-crypt) or [SOPS](https://github.com/getsops/sops) before commit. The unlock key for that mechanism is itself a GitHub Actions secret, never in the repo.
4. **No cloud APIs, no telemetry, no analytics, no crash reporters** are used at runtime — see CLAUDE.md hard rules.

---

## Secrets currently in use

| Secret | Where it lives | How CI gets it |
|---|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | GitHub Actions secret on the repo | Injected into `release.yml` workflow at build time |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | GitHub Actions secret (optional, only if the key was generated with a password) | Same as above |

The corresponding **public** key is committed in `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`. Public keys are safe to share — they only verify signatures, they do not sign.

There are currently no other secrets in use. The app does **not** require any cloud API key.

---

## How the Tauri updater keypair was generated

```bash
pnpm tauri signer generate -w .tauri/cs2-analyser.key
```

This produces two files in `.tauri/` (gitignored):

- `cs2-analyser.key` — **private key**. Add this as the `TAURI_SIGNING_PRIVATE_KEY` GitHub Actions secret. Never commit. Never share.
- `cs2-analyser.key.pub` — **public key**. The contents go into `src-tauri/tauri.conf.json`.

If you accidentally commit the private key, **revoke it immediately**: generate a new keypair, update both the GH secret and the `tauri.conf.json` pubkey, and force-rotate any in-flight release artefacts.

---

## How to add a GitHub Actions secret

1. Go to https://github.com/YaroslavSavchenk/cs2-analyser/settings/secrets/actions
2. Click *New repository secret*.
3. Name it exactly as the workflow expects (e.g. `TAURI_SIGNING_PRIVATE_KEY`).
4. Paste the value.

---

## If you discover a leaked secret

1. **Rotate it.** Issue a new credential, replace it everywhere, invalidate the leaked one.
2. **Scrub git history.** Use `git filter-repo` (preferred) or BFG Repo-Cleaner to remove the leaked blob.
3. **Force-push the rewritten history.** This is the *only* situation where force-pushing protected branches is allowed, and it requires temporarily lifting branch protection.
4. **Audit downstream.** Check release artefacts, CI logs, and any forks for the leaked value.

---

## Required GitHub Actions secrets

The CI/CD workflows in `.github/workflows/` reference the following secrets. Configure them at https://github.com/YaroslavSavchenk/cs2-analyser/settings/secrets/actions before triggering a release.

| Secret name | Required by | Required? | Description |
|---|---|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | `release.yml` | Yes | Full contents of the Tauri updater private key file (`.tauri/cs2-analyser.key`). Used to sign the MSI/NSIS update bundles so the in-app updater can verify them against the public key in `tauri.conf.json`. |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | `release.yml` | Yes (may be empty in v0.1) | Passphrase that protects the private key. In v0.1 the key was generated without a password, so this secret may be set to an empty string — but it must exist, otherwise the workflow's `env:` block resolves to an undefined value. |

The `ci.yml` workflow does **not** require any secrets — it only runs typecheck, build, and lint on public source.

### Notes

- Secrets are referenced exclusively through `${{ secrets.* }}` and injected into the build via `env:` blocks. They are **never** interpolated into `run:` shell scripts, so they cannot leak through `set -x`, `echo`, or shell tracing.
- `GITHUB_TOKEN` is provided automatically by GitHub Actions and is used by `softprops/action-gh-release@v2` to publish release artefacts. The `release` workflow declares `permissions: contents: write` so this token can create releases and upload assets.
- If you ever need to rotate `TAURI_SIGNING_PRIVATE_KEY`, follow the keypair regeneration procedure above **and** update `src-tauri/tauri.conf.json` with the new public key in the same PR — otherwise existing installs will reject the new signature.
