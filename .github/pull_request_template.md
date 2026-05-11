# Pull request

## Target branch

This PR targets (tick exactly one):

- [ ] `dev` — feature, fix, chore, docs, or refactor landing in active development
- [ ] `staging` — promotion PR from `dev` (feature-complete, ready for verification)
- [ ] `main` — promotion PR from `staging` (verified, ready for tagged release)

Direct commits to `staging` or `main` are forbidden. See `CLAUDE.md` for the full branch policy.

## Summary

<!-- 1-3 sentences on what changes and why. Focus on the why. -->

## Test plan

<!-- Bulleted checklist of how you verified this PR. -->

- [ ] Built locally on Windows (`pnpm tauri build`) — or explain why this is not required for this change.
- [ ] Frontend typecheck passes (`pnpm exec tsc --noEmit`).
- [ ] Rust passes (`cargo check`, `cargo clippy -- -D warnings`).
- [ ] Python analyzer compiles (`python -m py_compile analyzer/*.py`).
- [ ] Manual verification steps:

## Hard rules check

Confirm the change respects the project's hard rules (see `CLAUDE.md` and `docs/SECURITY.md`):

- [ ] No cloud APIs were added (no OpenAI, Anthropic, Google, etc., even as fallbacks).
- [ ] No telemetry, analytics, or crash reporters were introduced.
- [ ] No 5 GB vision model or other large binary is bundled into the MSI.
- [ ] No secrets, private keys, `.env` files, or `.dem` demo files are committed.
- [ ] No placeholder or fake data is presented as if a feature works when it does not.
- [ ] UI changes match the CS2-themed dark palette (no generic blue/purple AI gradients).

## Linked issues

<!-- Closes #123, Refs #456. -->
