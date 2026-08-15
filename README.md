# Huntzilla

A timed, three-question scavenger hunt web app with account creation, token-based session
handling, and a live leaderboard. Built as the final project for **MIS3502 - Web Service
Programming** at Temple University's Fox School of Business.

**Team:** Utkarsh Vaid, Chang Wang, Connor W Gal, Ziyad Eldafrawy (Fall 2024 course group). Per
the course's group structure, each member independently built the assignment; this
implementation - frontend and Lambda code - was written by Utkarsh Vaid and selected as the
group's submission.
**Course scaffold:** Jeremy Shafer (routing/event-handler skeleton, database connection helper)

> For the full technical and design story, see [`docs/BUSINESS_CASE.md`](docs/BUSINESS_CASE.md),
> [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), and [`docs/CODE_REVIEW.md`](docs/CODE_REVIEW.md).

---

## What it does

1. A visitor creates an account or logs in. A successful login issues a token, stored in the
   browser and attached to every subsequent request.
2. Starting a hunt runs `SELECT ... ORDER BY RAND() LIMIT 1` against the `games` table and
   copies the selected row (three questions/answers) into a new "in-progress" record tied to
   the player's token. In practice, `games` only ever contained one row (a hunt around Charles
   Library, Morgan Hall, and the Bell Tower), so every player received the same three questions -
   the randomization logic works correctly, but the data never gave it more than one option to
   choose from.
3. The player submits answers one at a time; each is checked server-side and the result is
   written back before the next question is shown.
4. Completing all three correctly ends the hunt, records the elapsed time, and posts it to the
   leaderboard - shown as a top-3 podium and a Chart.js bar chart of the fastest 5 times.
5. Quitting or closing the tab cancels the in-progress hunt via a `DELETE` request sent with the
   browser's `keepalive` flag, so the cleanup call survives the page unloading.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML/CSS/JavaScript, jQuery, Chart.js, canvas-confetti |
| API | Amazon API Gateway (REST API, single `{proxy+}` resource, `ANY` method) |
| Compute | AWS Lambda (Node.js, `mysql2/promise` for the database driver) |
| Database | MySQL (Temple University-hosted instance) |
| Auth | Custom UUID token issued on login, stored client-side in `localStorage` |

## Architecture, in one line

```
Browser (jQuery AJAX / fetch)
   -> API Gateway (single proxy resource, forwards method + path + body as-is)
      -> Lambda (parses path, routes internally to a handler function)
         -> MySQL (new connection opened and closed per invocation)
```

Every request opens its own database connection, opens a new response object, and closes the
connection before returning - there is no persistent process and no connection pooling. See
`ARCHITECTURE.md` for the full request-by-request breakdown and schema.

## Data model

Five tables, confirmed directly against `information_schema` (see `docs/ARCHITECTURE.md` for
the full column-level breakdown and an ER diagram):

| Table | Purpose |
|---|---|
| `users` | Accounts: name, username, password, `isadmin` flag, `lasttoken` |
| `logins` | One row per login: issued token + timestamp, linked to a `userid` |
| `games` | Question-set templates (intro + 3 Q/A pairs) `startgame` selects from - contained a single row in practice |
| `gameprogress` | A live, in-progress hunt: a copy of one `games` row plus the player's guesses |
| `leaderboard` | Completed-hunt times, denormalized (stores `username` directly, no join) |

**Important, confirmed detail:** none of these tables have a declared `FOREIGN KEY` constraint.
Relationships (`gameprogress.userid` -> `users.userid`, etc.) are real and consistently used in
every query, but they're enforced entirely by the application's own logic, not by the database.
Reverse-engineering this schema in a tool like MySQL Workbench will show five separate tables
with no connecting lines for exactly this reason - not a tooling issue.

## Known limitations

This was a graded academic project built under a real time constraint, not a production system.
Documented honestly rather than glossed over - full detail and reasoning in `CODE_REVIEW.md`:

- Passwords are stored and compared in plain text (no hashing).
- Session tokens never expire once issued.
- Two different, inconsistent methods are used across the codebase to validate a token.
- A new MySQL connection is opened and torn down on every single request (no pooling).
- Refreshing the browser mid-game triggers the same cleanup path as quitting, cancelling the
  active hunt.
- No foreign key constraints exist at the database level; referential integrity between tables
  is entirely the application's responsibility.
- `users.isadmin` is stored as a `varchar` (`'Y'`/`'N'`), not a boolean type.
- `games.lastmodifiedby` exists in the schema but is never read or written by any code path.
- The random hunt-selection query (`ORDER BY RAND() LIMIT 1`) is correctly written, but `games`
  only ever held one row - so in practice every player got the same fixed set of three questions.
  This is a data-population gap, not a code bug: the mechanism for variety exists and would work
  immediately if more rows were added.

## Setup

This project depends on a specific Temple University-hosted MySQL instance and is not intended
to be run as a general-purpose deployable app. To adapt it:

1. Copy `server/.env.example` to `server/.env` and point it at your own MySQL instance and schema
   (see `docs/ARCHITECTURE.md` for the table structure).
2. Deploy `server/index.mjs` as a Lambda function (Node.js runtime), with `DB_USER`, `DB_PASSWORD`,
   `DB_NAME`, and `DB_HOST` set as Lambda environment variables.
3. Put a REST API Gateway in front of it using a single `{proxy+}` resource with the `ANY` method,
   forwarding to the Lambda with Lambda proxy integration.
4. Update `endpoint01` in `js/app.js` to point at your deployed API Gateway stage URL.
5. Open `index.html`.
