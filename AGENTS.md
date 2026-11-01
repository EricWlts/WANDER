# AI Development Rules

## Project

This is an existing frontend application.
Preserve its architecture, visual identity and functionality.

## Rules

- Work on one task at a time.
- Read only files relevant to the task.
- Make minimal, targeted changes.
- Do not modify unrelated features.
- Do not add dependencies without approval.
- Preserve existing styling and animations.
- Follow the conventions in ARCHITECTURE.md.
- Run relevant tests and build checks.
- Never modify secrets or environment variables.
- Never deploy or push without permission.

## Task Execution

1. Read the assigned task from TASKS.md. A new natural-language request is the assignment; record its scope and acceptance criteria there without starting other open tasks.
2. Identify relevant files.
3. Implement the smallest correct solution.
4. Run available checks.
5. Fix directly caused errors.
6. Summarize changes and remaining problems.

## Escalation

If a task requires major architectural decisions
or cannot be solved reliably, stop and report
the problem instead of guessing.

## Native Codex Workflow

- Follow `docs/DEVELOPMENT.md`. Use native Codex subagents and review/browser/worktree tools. Do not run the Python orchestrator or its planning, execution, memory or APPLY commands.
- The user authorizes native delegation for WANDER development through these instructions. Do not start agents for configuration smoke tests or unnecessary exploration.
- Work on one user task; at most one subagent at a time, no recursive delegation. Small tasks stay in the main agent when it already uses the suitable model. Do not duplicate the same investigation in parent and child.
- Default: `gpt-6-luna`, low effort for trivial text/style fixes, medium for bounded logic changes. Use `gpt-6.1-sol`, medium (high only if needed), for coupled state, persistence, auth, asynchronous behavior or unclear multi-file changes.
- Use `gpt-6-astra`, low initially, only for architecture decisions, material unresolved uncertainty after targeted investigation, or two failed, distinct solution attempts. Give it a bounded question and evidence; return implementation to Sol. Do not use Astra for routine reviews or retries. Report proposed architecture changes to the user before implementing them.
- Check the current tool's available models/parameters before delegating. With `spawn_agent`, choose the model and reasoning explicitly and use `fork_turns="none"` for model overrides; supply only the task, relevant rules/files, acceptance criteria and prior failure evidence. If custom agent roles are unavailable, direct native model selection is sufficient. Never silently substitute a more expensive model or fall back to a custom orchestrator.
- Keep the main chat's coordination short. A project model setting does not change an already-running chat's model; if the current main model is expensive, use a fresh Luna chat for routine work rather than paying for repeated delegation.
- Give each worker an explicit file scope and expected checks. Only one writer edits a given file. Workers report changes, checks, uncertainties and remaining issues; they never commit, merge, push, deploy or approve their own work.

## Draft, Preview and Approval

- Before future application changes, inspect Git status and attached worktrees. Reuse a suitable isolated draft, or create a managed worktree with a `codex/` branch before editing. Record its path, starting revision and task. Never overwrite or clean existing user changes. Worktrees start from committed state: if required uncommitted changes are missing, stop and explain the dependency instead of silently testing an older baseline or committing user work.
- All feedback rounds use the same draft. State: drafting → checking → awaiting feedback → approved → integrated. Track only the current task in TASKS.md; no separate orchestration database.
- Run the relevant existing tests and build in the draft. For UI changes, start its Vite preview on a free loopback port, open the exact URL in Codex's browser and give concrete desktop/mobile checks. Ensure the server serves the draft, not the original checkout. See the data restrictions in `docs/DEVELOPMENT.md` before starting a backend.
- Before approval, inspect the task diff for regressions, scope and test gaps. Use the native review panel and, for substantive logic changes, one independent native review subagent after the worker finishes (Luna for bounded changes, Sol for complex/risky ones). A self-check is enough for trivial copy/style edits. Fix actionable findings, repeat only affected checks, and report any missing browser coverage.
- Present the draft URL, concise changes, checks and remaining limitations. Then ask for explicit approval of that concrete revision. Feedback requests authorize draft edits only. Silence or a successful build is not approval.
- Only an explicit instruction such as “Diesen Stand übernehmen” authorizes local integration of the reviewed task into the original checkout. Verify neither source nor target changed since review; preserve unrelated work and stop on conflicts. New edits invalidate approval. Do not commit unless requested; do not push or deploy without separate explicit permission. “Verwerfen” discards only this task's isolated draft after checking for unrelated work.
