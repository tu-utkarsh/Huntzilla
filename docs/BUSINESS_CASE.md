# Business case

## Context

Huntzilla was the final project for **MIS3502 - Web Service Programming**, part of the
Management Information Systems curriculum at Temple University's Fox School of Business. The
assignment's core technical requirement, set by the course's routing/connection template: build
a single AWS Lambda function that dispatches to multiple "features" based on HTTP method and
path, backed by a shared, Temple-hosted MySQL database that every student in the course connects
to.

**Team:** Utkarsh Vaid, Chang Wang, Connor W Gal, Ziyad Eldafrawy - a four-person course group.
The course structured group work so that each member independently built their own version of
the assignment; the group then submitted whichever member's implementation ran correctly with
the fewest errors. This implementation - both the frontend and the Lambda backend - was built
independently by Utkarsh Vaid and was the version selected as the group's final submission.
Everything described as a design decision in this document reflects individual work, submitted
under the group's name for grading, not a jointly-built codebase.

## The constraint that shapes almost every architectural decision in this project

Two things were fixed before the team wrote a single line of application logic, and they explain
several choices that would otherwise look like odd defaults:

1. **The database was shared, university-managed infrastructure** (`dataanalytics.temple.edu`),
   not something the team could redesign, add connection pooling to, or provision independently.
   The team's own code sits entirely on top of a database whose operational characteristics were
   fixed by the university, not chosen by the team.
2. **The Lambda event-handler and connection-lifecycle code was provided by the course**
   (marked "DO NOT EDIT" in the source), including the pattern of opening a new database
   connection at the start of every invocation and explicitly closing it before every response.
   This is why the project has no connection pooling - it wasn't a design decision made by the
   team, it was the scaffolding they were required to build on top of.

Everything else in this implementation - the routing logic inside that scaffolding, the
authentication flow, the game state machine, the leaderboard, the frontend - was built
independently by one team member (Utkarsh Vaid), inside those two fixed constraints, not
around them.

## What went beyond the assignment's minimum

The assignment's baseline requirement was a working dispatcher with a handful of features. This
implementation went beyond that baseline in a few specific, identifiable ways:

- **A full authentication flow** (signup, login, token issuance) rather than a stubbed or
  hardcoded user.
- **A three-question, timed, stateful game** with its own status machine (`ACTIVE` /
  `COMPLETE`), rather than a single stateless request/response feature.
- **A leaderboard with a live UI** - a Chart.js bar chart and a top-3 podium - rather than a
  raw JSON dump of scores.
- **A deliberate UX decision in `startGame`**: rather than blocking a user who already has an
  active game, this implementation resets and reuses the existing game record, so re-entering
  the page doesn't dead-end the player.
- **A `fetch()`-with-`keepalive` cleanup call** on tab close/refresh - a detail easy to miss,
  since jQuery's `$.ajax` (used everywhere else in the app) has no equivalent capability.

## A capability the schema supports but was never used

The `games` table's schema (a `lastmodifiedby` column, an `intro` field written like an
admin-facing instruction) could support **multiple, admin-editable hunts**, selected at random
via the `ORDER BY RAND() LIMIT 1` query in `startGame`. In practice, only one row was ever
populated. This wasn't a team plan that ran out of time - it was never discussed or pursued;
the assignment was graded on a single fixed set of three questions, and the possibility of
populating `games` with multiple rows for real variety simply wasn't something the team explored.
The column structure may reflect the original course template's design intent rather than
anything built toward here. The randomization logic is correct and would work immediately if
more rows were added - it just never had more than one option to choose from.

## Why this matters as a portfolio piece, honestly

This project demonstrates designing and shipping a full authentication + stateful-session
system on top of infrastructure I didn't control, making real UX judgment calls (the game-reuse
decision) beyond the assignment's letter, and identifying a genuine technical edge case
(`beforeunload` + `keepalive`) worth handling correctly. Worth stating plainly rather than
glossing over: this was submitted as a group project, but the codebase itself - frontend and
backend both - was built independently, and was selected over the other members' attempts
specifically because it ran correctly. The honest limitations documented in `CODE_REVIEW.md` -
plaintext passwords, no token expiry, connection-per-request - are largely inherited from the
two fixed constraints above, not signs of not knowing better; where there was actual latitude,
the decisions made were reasonable and, in a few places, more thoughtful than the assignment
required.
