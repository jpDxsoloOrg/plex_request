# Decisions for review

Choices made while building the Movie Date integration. Each one can be changed.

| # | Question | Chosen | Alternative | Why |
|---|---|---|---|---|
| 1 | How is `integration` restricted to Movie Date's role? | Caller-side IAM only: no resource policy, so Movie Date's role needs `lambda:InvokeFunction` on this one ARN | A `lambda:Permission` naming the role in this stack | The spec allows either. A resource policy would fail the deploy if the role doesn't exist yet and wouldn't stop other same-account principals with Lambda rights |
| 2 | `findUser` when two confirmed accounts differ only by email case | Return no match | Return the first | The pool is case-sensitive, so this can happen, and linking the wrong account would spend someone else's requests |
| 3 | `posterPath` from Movie Date | A bare TMDB path becomes a `w500` image URL; https URLs pass through; anything else is rejected | Store what's sent | Plex Request uses the field directly as an image `src`, so a bare path would show a broken poster to admins |
| 4 | `createRequest` media type | Always movie; `mediaType` and `seasons` are ignored | Accept TV now | The Sonarr lookup bug must be fixed before any TV request comes through this path |
