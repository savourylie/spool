# Upstream Attribution

This folder is a **vendored snapshot** of the AK-Threads-Booster skill repo, kept in-tree for reference — the Python scripts and knowledge markdown inform future TypeScript ports inside spool, and `REPORT.md` / `../../AK_INTEGRATION_PLAN.md` reference these files directly.

| Field | Value |
|---|---|
| Upstream repository | `git@github.com:savourylie/AK-Threads-booster.git` |
| Upstream homepage | https://github.com/akseolabs-seo/AK-Threads-booster |
| Snapshotted commit | `dff88c546949809cb84b4009d2a61385e4f38c4f` |
| Upstream commit date | 2026-04-21 00:54:53 +0700 |
| Vendored into spool on | 2026-04-22 |
| License | MIT (see `LICENSE` in this folder) |
| Author | AK SEO Labs |

## Notes

- This is a **snapshot**, not a live dependency. Upstream changes do **not** flow in automatically. To refresh, delete this folder, re-clone from upstream, remove the nested `.git`, update this file with the new commit SHA, and commit.
- `REPORT.md` at the root of this folder is spool-authored analysis of the upstream repo — not part of the upstream project. Keep it when refreshing.
- Files inside `.claude-plugin/`, `skills/`, `knowledge/`, `scripts/`, `templates/`, `examples/`, and the READMEs are verbatim from upstream at the commit above.
