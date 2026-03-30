# Git And Change Request Workflow

This project uses Git and GitHub together with lightweight documented change requests.

## Goals

- Keep a clear record of why changes are made
- Tie documentation changes to code changes
- Make reviews easier
- Preserve traceability from request to implementation

## Repository Convention

- `main` is the current approved baseline
- `docs/change-requests/` stores formal change request documents
- Each significant feature, behavior change, or scope change should have a change request ID

## When To Create A Change Request

Create a documented change request when:

- adding a new feature
- changing product behavior
- changing routing logic in a meaningful way
- changing API contracts
- changing deployment or operational behavior
- changing scope described in the PRD or spec

You usually do not need a formal change request for:

- typo fixes
- minor text clarifications
- cosmetic formatting-only changes
- small internal refactors with no behavior change

## Suggested Process

1. Copy `docs/change-requests/change-request-template.md` into a new file such as `docs/change-requests/CR-001-add-gpx-export.md`.
2. Fill in the reason, scope, risks, and acceptance criteria before implementation starts.
3. Create a Git branch for the change.
4. Implement the change in code and update docs as needed.
5. Open a pull request that references the change request ID.
6. Review both the code and the change request together.
7. Merge to `main` only after approval.

## Branch Naming

Recommended branch format:

- `codex/cr-001-short-description`

Examples:

- `codex/cr-001-add-gpx-export`
- `codex/cr-002-real-wind-provider`
- `codex/cr-003-linux-deployment-hardening`

## Commit Naming

Recommended commit prefixes:

- `docs:` for documentation changes
- `feat:` for new features
- `fix:` for bug fixes
- `refactor:` for internal restructuring
- `chore:` for maintenance work

Examples:

- `docs: add CR-001 for GPX export`
- `feat: add GPX export for computed routes`
- `fix: improve route validation for land points`

## Pull Request Expectations

Each pull request should include:

- Change request ID
- Summary of what changed
- Files or areas affected
- Testing performed
- Remaining risks or follow-ups

Suggested PR title format:

- `CR-001: Add GPX export`

## Documentation Rules

Update the PRD when:

- user goals change
- scope changes
- key workflows change

Update the technical spec when:

- APIs change
- routing behavior changes
- architecture changes
- data dependencies change

Update the README when:

- setup changes
- runtime behavior changes
- deployment steps change

## Minimal Example

For a new feature such as GPX export:

1. Create `docs/change-requests/CR-001-add-gpx-export.md`
2. Create branch `codex/cr-001-add-gpx-export`
3. Implement code and docs updates
4. Open PR `CR-001: Add GPX export`
5. Merge after review

## Current Baseline

The current repository baseline is documented in:

- `docs/change-requests/CR-000-baseline-mvp.md`
