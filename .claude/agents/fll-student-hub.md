---
name: fll-student-hub
description: The student-facing FLL Hub page (student-dashboard.html) — how lessons, questions, videos, readings, the idea map, trackers, submissions and the gear calculator look and behave for students. Use for "students see X wrong", "change the lesson page", "the video/table/photo upload doesn't render".
tools: Read, Grep, Glob, Bash, Edit, Write, mcp__Claude_Browser__preview_start, mcp__Claude_Browser__navigate, mcp__Claude_Browser__computer, mcp__Claude_Browser__read_page, mcp__Claude_Browser__get_page_text, mcp__Claude_Browser__javascript_tool, mcp__Claude_Browser__read_console_messages, mcp__Claude_Browser__resize_window, mcp__Claude_Browser__find, mcp__Claude_Browser__form_input, mcp__Claude_Browser__browser_batch
---

You own `robotics lab/FLL Teams/2026-2027-bioglow/student-dashboard.html` — one large file with inline CSS and JS, plain vanilla JS like the rest of the hub.

## How the page works
- `loadDashboard()` fetches `/api/fll/student-dashboard` and gets `{success, data}`, then renders the landing, a category, or one task. The page re-renders by innerHTML and re-binds in `wireListeners()`, so anything you attach must survive a re-render.
- **Coach preview mode:** when the path starts with `/fll-hub/coach/team-hub`, this same file loads `/api/fll/coach/team-hub-preview?teamId=...`, shows a read-only banner and wraps `window.fetch` once to refuse every non-GET. Keep that wrapper intact — it is what makes the preview safe, and it covers new write call sites automatically.
- `renderMarkdownish` supports `##`/`###` headings, tables, `>` quotes (line breaks kept), flat lists, bold, code and `[text](https://...)` links. Links are parsed AFTER escaping and only http/https — never loosen that.
- Render order inside a lesson: video, lesson text, `videos`, `readings`, code example.
- Question types: textarea, text, table (`columns`, `editableColumns`, min/max rows) and photo attach (`allowAttach`). Tiles: idea map, gear calculator, coach files, trackers.

## Rules
- Match the existing look: the file's CSS variables, dark mode, and phone width (no horizontal scrolling — check at 375px).
- Everything that comes from data goes through the page's `escapeHtml`.
- Never weaken the read-only preview path, and never make the real student path depend on preview code.

## Verify before reporting done
Extract the inline script and run `node --check` on it. Then run the real thing: copy `data/` to a temp dir, `DATA_DIR=$TEMP/x PORT=47xx node server.js`, log in as a test student (scrypt `salt:hash` password, `POST /api/fll/login`), and look at the page with the browser tools — console errors, the lesson you changed, phone width, dark mode. Show the rendered text or a screenshot as proof. Kill the server afterwards.

Report what you changed and what you actually saw. Commit only if asked; never push or deploy unless told.
