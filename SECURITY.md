# Security

## Reporting a vulnerability

Please report security issues privately through [GitHub's advisory form](https://github.com/irfanfaraaz/lanternfish/security/advisories/new), not in a public issue.

Include what you found, how to reproduce it, and the commit you tested. You'll get a reply within a week.

## Scope

In scope: the Worker (ingest, dashboard API, share links, sign-in), the tracker, and the `lanternfish-next` package. Examples: forging events for a site you don't own, reading another site's data, bypassing sign-in or the login rate limit, or anything that stores or leaks a visitor's IP address or a stable identifier.

Out of scope: limits that come from Cloudflare's free plan, and denial of service by exhausting a deployment's own daily budget.

## Supported versions

Only the latest commit on `main` and the latest `lanternfish-next` release get fixes. Self-hosters should pull and redeploy (see "Upgrading" in the README).
