# Audit implementation — 2026-09-30

Baseline: consolidated `staging` at `1231f35`. Main and production stay unchanged.

## Scope and checks

- FA-01–05: modal close/focus/reopen, profile reentry/failure/late responses, rank artwork, social link names and invalid-sort HTTP 400.
- M01–05: supported build dependencies, server-owned calculations/registry, one dated profile snapshot, local expansion state, shared bounded request cache, safe provider diagnostic codes, canonical RA metadata and API contracts.
- M06: additive publication provenance, compatibility reader, same-population rescoring, rejection of mismatches and interrupted publication preserving valid data.
- M07–10: fixture browser/HTTP/import checks, environment-specific API origins, Node 24, lazy routes, labelled score rows/loading/reduced motion, inactive code removal and current documentation.
- M11: legacy remains the live default. Opt-in Trainer adapter and bounded parity command preserve the bulk contract; no active collection is switched. Fixture parity is verified; live parity waits for the shared backfill lock.
- M12: required settings and disposable restore rehearsal. Owner chose indefinite local retention; pruning and off-VPS transfer are absent. The live timer script is updated.

QA boundary: existing score fixtures plus coalescing/cooldown, publication/rescore and real HTTP tests; offline importer identity/threshold/mode/failure fixtures; built-site browser lifecycle/navigation/freshness tests. Private preview is checked after the integrated build. No Actions workflow, public deployment or upstream definition recrawl is part of this pass.

## Results

- Clean Node 24 install and Vite 8 production build passed; npm audit reports zero vulnerabilities. Initial JavaScript entry is 123 kB (46 kB gzip), with lazy page chunks.
- 41 Node tests, four offline importer tests and six browser tests passed. Seven publication/database/HTTP tests also passed after the final connection cleanup.
- Private preview: real Sixshot run close/reopen/Escape and scroll restoration passed; VTSaibot rank artwork loaded; mobile catalog had no horizontal overflow or browser exceptions. Invalid sort returns HTTP 400; existing compatible standings remain readable.
- Disposable PostgreSQL/Umami restore passed, including administrator login and the authenticated websites endpoint. A fresh live daily backup succeeded with mode 0600. Live analytics volumes were untouched.
- Existing Tailscale route serves the updated private preview at https://vps.snapper-cod.ts.net:5194. Source commits remain local on `staging`; main, the public app and the active backfill are unchanged.

## Rollout and recovery

Readers accept matching unversioned files during rollout. New writers publish provenance; only enable strict version enforcement once all served files are versioned. Rehearse rescoring in a copied data directory and keep the matching code/definitions/database pair for rollback. Active backfill is left running with its already-loaded code. The optional modern collector starts in a separate directory after live parity; it cannot resume legacy staging scores.

Dependency rollback uses the previous lockfile and built artifact. Private preview can return to its previous commit/build independently of production. Analytics restore mounts no live volume and has no published ports; temporary containers/keys are removed after the check. The live backup timer retains every daily dump locally without expiry.
