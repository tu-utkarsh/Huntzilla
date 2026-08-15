# Code review

This is a deliberately honest retrospective, not a resume gloss. Every item below was found by
actually reading the code, the API Gateway configuration, and the live database schema - not
guessed at. The goal is to demonstrate the ability to critique this work accurately, including
its real weaknesses, rather than to present it as flawless.

## What's genuinely solid

- **Every SQL query uses parameterized placeholders** (`connection.execute("... WHERE username
  = ?", [username])`), consistently, everywhere. No string concatenation of user input into SQL
  anywhere in the codebase - this is the correct defense against SQL injection, done right
  throughout, not by luck.
- **Error handling was added on top of the course template**, which didn't include any -
  `signup`, `startGame`, `guess1`/`2`/`3`, `endgame`, and `cancelGame` all wrap their logic in
  `try`/`catch` and return a structured error rather than letting an exception crash the
  invocation silently.
- **The `startGame` reuse logic is a real, deliberate UX decision.** Rather than blocking a
  player who already has an active game, it resets the existing `gameprogress` row and lets
  them continue - avoiding a dead-end that a stricter implementation would have produced.
- **`cancelGameController` uses native `fetch()` with `keepalive: true`** instead of jQuery's
  `$.ajax` (used everywhere else in the frontend) specifically because `$.ajax` has no
  equivalent - `keepalive` lets the cleanup request survive the page actually closing.
- **Frontend accessibility attributes** (`role="navigation"`, `aria-label` on form fields) were
  added deliberately - not something most projects at this stage bother with at all.
- **The frontend and backend agree on data format consistently.** Every request is sent as
  URL-encoded form data (`jQuery.serialize()`, manual `"token=...&guess=..."` strings), matching
  the backend's `qs.parse(request["body"])` exactly - no format mismatches anywhere in the
  request path.

## Security findings

- **Passwords are stored and compared in plain text.** `signup` inserts the raw password
  directly; `postLogin` compares it with a direct string match. A real system would hash with
  bcrypt (or similar) before storage and never compare plaintext.
- **Session tokens never expire.** Once issued, a token in `users.lasttoken` remains valid
  indefinitely until explicitly nulled by `endgame` or `cancelGame` - there's no expiration
  column or time-based invalidation anywhere.
- **Tokens are stored in `localStorage`, not `sessionStorage`.** Combined with the point above,
  a token issued on a shared or public machine remains valid indefinitely unless someone
  explicitly logs out - `sessionStorage` (cleared when the tab closes) plus a real expiration
  column would be the fix.
- **A live database credential was originally hardcoded directly in source** (removed in this
  repo's version of `server/index.mjs`, which now reads from environment variables). Worth
  stating plainly: this is exactly why credentials should never be committed in the first place,
  regardless of whether a repo is public or private.

## Data integrity findings

- **No table has a declared `FOREIGN KEY` constraint**, confirmed directly against
  `information_schema.columns` and by reverse-engineering the schema in MySQL Workbench, which
  draws all five tables with no connecting lines for exactly this reason. Every relationship
  (`gameprogress.userid` -> `users.userid`, etc.) is real and used consistently in every query,
  but nothing at the database level actually enforces it - referential integrity is entirely the
  application's responsibility.
- **`users.isadmin` is a `varchar` (`'Y'`/`'N'`)**, not a boolean or tinyint - a detail easy to
  assume incorrectly without checking the real schema.
- **`games.lastmodifiedby` exists but is never read or written by any code path** - a column
  that outlived whatever it was originally meant for, or was scoped and never built out.
- **`games` held exactly one populated row for the life of this project.** The `ORDER BY RAND()
  LIMIT 1` selection in `startGame` is correct, working SQL - it would genuinely randomize across
  multiple hunts if more rows existed. It simply never had more than one option to choose from,
  so every player received the same three questions. This is a data-population gap, not a logic
  bug.

## Logic and consistency findings

- **Two different, inconsistent mechanisms validate a token across the codebase.**
  `getUserByToken` (used only in `startGame`) joins `users` to `logins` on the token column.
  Every other function that needs to validate a token (`guess1`/`2`/`3`, `endgame`,
  `cancelGame`) instead checks `users.lasttoken` directly, never touching `logins` at all. Both
  work, but they're not the same check, and `logins` isn't consistently treated as the source of
  truth for session validity.
- **Inconsistent error status codes.** `signup`'s catch block correctly returns `500` for an
  unexpected server-side failure; `guess1`/`2`/`3`'s catch blocks return `400` even for a genuine
  server exception, which doesn't match HTTP status code semantics (400 implies the client's
  request was malformed; a thrown exception in the handler is a server-side failure).
- **A likely copy-paste artifact:** the route for `debugusers` calls `getUsers(res, features,
  200)` - three arguments - but `getUsers` is defined as a two-parameter function `(res, query)`.
  It works only because the function never uses its second parameter, so the extra arguments are
  silently ignored.
- **Response shape mismatch between frontend expectations and backend reality.** Frontend error
  handlers frequently check `xhr.responseJSON.message`, but most backend error responses are
  plain strings (`formatres(res, "Token is required.", 400)`), not `{message: "..."}` objects.
  This works in practice only because the frontend falls back to `xhr.responseText` when
  `.message` is undefined - a real mismatch, softened by a defensive fallback that happens to
  compensate for it.
- **Duplicate event bindings.** `$('#btnQuit,#link-logout')`, `$('#btnQuit2,#link-logout')`, and
  `$('#btnQuit3,#link-logout')` are bound in three separate `.click()` calls, each including
  `#link-logout`. jQuery stacks handlers rather than replacing them, so a single click on the
  logout link fires `cancelGameController()` three times in a row. Harmless here (`DELETE` on an
  already-deleted row is a no-op), but a real, findable artifact of copy-pasting a handler
  pattern across three quit buttons without noticing the shared selector.

## An open question, unresolved

`window.addEventListener("beforeunload", ...)` triggers `cancelGameController()`, which deletes
the active `gameprogress` and `logins` rows. `beforeunload` fires on tab close, browser close,
**and a plain page refresh** - meaning a simple accidental refresh mid-game cancels the active
hunt, not just a deliberate quit. Whether this was an intentional anti-cheat measure (preventing
someone from refreshing away a bad guess without penalty) or an unintended side effect of reusing
`beforeunload` for quit-cleanup was never conclusively settled during this review. Worth deciding
explicitly, one way or the other, if this project were revisited.

## If I revisited this project

| Finding | Fix |
|---|---|
| Plaintext passwords | Hash with bcrypt before storing; never compare plaintext |
| No token expiration | Add an `expires_at` column, check it on every validated request |
| Two inconsistent token-validation paths | Consolidate into one function, used everywhere, with `logins` as the actual source of truth |
| No connection pooling | Replace `mysql.createConnection` with `mysql.createPool`, reuse across invocations |
| No foreign key constraints | Add real `FOREIGN KEY` constraints once the schema is otherwise stable |
| Single-row `games` table | Populate multiple hunts; the random-selection logic already supports it |
| Duplicate event bindings | Bind `#link-logout` once, outside the three per-page quit-button selectors |
| Refresh cancels active game | Decide deliberately: either preserve state across a refresh, or make the cancellation an explicit, confirmed action rather than a side effect of `beforeunload` |
