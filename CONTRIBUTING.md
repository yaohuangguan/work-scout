# Contributing to WorkScout

Thanks for improving WorkScout.

The project is deliberately small, so useful contributions should stay focused and easy to review.

## Good first contribution areas

- add or improve a public work-source adapter
- fix parsing edge cases
- improve eligibility inference
- improve ranking tests
- improve duplicate detection
- improve accessibility or responsive behavior
- add regression tests for a real bug

## Before opening a PR

Run:

```bash
npm install
npm run db:migrate:local
npm run check
npm run smoke
```

A PR should not knowingly leave TypeScript errors, failing tests, or a broken production build.

## Source adapter rules

A new discovery source should:

1. be publicly accessible or used through an appropriate official API
2. preserve attribution
3. link users back to the original opportunity
4. avoid copying more source content than needed for discovery
5. fail independently from other sources
6. normalize into the existing `WorkItem` shape
7. include a test for any non-trivial parsing or ranking logic

Do not add scraping that depends on bypassing authentication, access controls, or anti-bot restrictions.

## Product principles

Please preserve these behaviors:

- “Remote” is not automatically treated as worldwide.
- Uncertain eligibility should stay uncertain.
- Direct leads and formal jobs are visibly distinguishable.
- The original source should never be hidden.
- Search should continue working without an LLM key.
- Do not require an account for features that work well locally.
- Avoid tiny UI text; readability matters.

## Pull requests

Keep PRs narrow where possible.

A useful PR description includes:

- what changed
- why it changed
- how it was verified
- screenshots for meaningful UI changes
- any new external source and its usage constraints

## Commit style

Short conventional-style messages are preferred, for example:

```text
feat: add Lever source adapter
fix: preserve uncertain APAC eligibility
test: cover duplicate community posts
docs: explain source adapter contract
```

## Database changes

Keep `schema.sql` idempotent where possible.

If a change requires destructive migration behavior, explain it explicitly in the PR instead of hiding it in a generic schema update.

## Security

Do not include secrets, API keys, tokens, private user information, or production credentials in issues, commits, screenshots, or test fixtures.

For vulnerabilities, follow [SECURITY.md](SECURITY.md).
