# \# AGENTS.md

# 

# \## Project: NORTHVALE ERP V2

# 

# \## Working rules

# 

# \- Make the smallest safe change. Do not rewrite unrelated code.

# \- Preserve existing UI style and behavior unless clearly broken.

# \- Before editing, inspect relevant files and briefly state the plan.

# \- After editing, summarize changed files, checks run, and remaining risks.

# \- Do not invent APIs, routes, database columns, fields, env vars, or permissions. Verify from existing code first.

# \- Avoid adding dependencies unless necessary.

# \- Do not change database schema, auth rules, deployment settings, or environment variables unless explicitly asked.

# \- If a task is broad, narrow it into the safest useful patch first.

# 

# \## Quality gates

# 

# \- Run available lint, typecheck, tests, and build commands after code changes.

# \- Fix only in-scope failures caused by or related to the touched areas.

# \- If a check fails outside scope, report it clearly instead of rewriting unrelated code.

# \- Do not claim tests passed unless they were actually run.

# \- If a command is unavailable or fails due to missing setup, report the exact reason.

# 

# \## ERP stability expectations

# 

# \- Check core features, data flow, syncing, state persistence, and UI navigation.

# \- Check loading, empty, error, offline, refresh, duplicate-submit, and sync-conflict cases.

# \- Every secondary screen, modal, form, detail page, and edit page should have a clear Back or Cancel path.

# \- Back behavior should return to the correct previous screen/state when possible.

# \- For direct visits, use a safe route fallback.

# \- Protect submit actions from double-click or duplicate submit.

# \- Avoid duplicate records, stale UI state, broken filters, incorrect totals, and silent save failures.

# \- Show clear user feedback for save, update, delete, sync, and error states.

# 

# \## UI and UX expectations

# 

# \- Preserve the existing NORTHVALE visual style.

# \- Keep layouts responsive for mobile and desktop.

# \- Do not introduce confusing duplicate buttons.

# \- Use clear labels for actions like Save, Cancel, Back, Submit, Create, Update, Delete, and Retry.

# \- Destructive actions should require confirmation or have a safe guard.

# \- Forms should prevent invalid submit and show useful validation messages.

# \- Empty states should explain what the user can do next.

# 

# \## Data and syncing expectations

# 

# \- Verify data fields from existing code before using them.

# \- Do not invent table names, columns, API endpoints, or statuses.

# \- Keep local UI state consistent with saved data.

# \- Handle failed saves gracefully.

# \- Avoid race conditions from repeated clicks, fast navigation, or refresh.

# \- Make sure create/update/delete flows refresh or invalidate stale data correctly.

# \- If there is offline or pending-sync logic, preserve it and check conflict behavior.

# 

# \## Navigation expectations

# 

# \- Check all main flows that create, edit, view, cancel, or return to a previous page.

# \- Back or Cancel should not strand the user.

# \- Prefer returning to the previous screen when history exists.

# \- Use a safe fallback route for direct page visits.

# \- Modals and drawers should close cleanly without losing unrelated page state.

# \- After successful creation, route the user to the correct detail/list page.

# 

# \## Code style expectations

# 

# \- Follow the existing project patterns.

# \- Prefer simple readable code over clever abstractions.

# \- Reuse existing utilities/components when available.

# \- Keep changes localized.

# \- Avoid large refactors unless required to fix the issue.

# \- Add comments only when they clarify non-obvious logic.

# 

# \## Security and safety

# 

# \- Do not expose secrets, tokens, API keys, or private environment values.

# \- Do not log sensitive user, customer, supplier, inventory, or financial data.

# \- Do not weaken authentication, authorization, validation, or permissions.

# \- Do not make public claims about compliance, certification, or audit status unless already verified in the project.

# 

# \## Reporting format

# 

# After completing work, return:

# 

# 1\. What was inspected

# 2\. What changed

# 3\. Files changed

# 4\. Commands/tests run

# 5\. Results of checks

# 6\. Remaining risks

# 7\. Manual QA steps needed

