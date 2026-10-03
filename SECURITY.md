# Security policy

## Supported version

WorkScout is currently an early product. Security fixes are applied to the latest code on `main`.

## Reporting a vulnerability

Please do **not** open a public GitHub issue for vulnerabilities involving:

- Cloudflare Worker or D1 access
- community-post abuse that exposes private data
- authentication or authorization if those features are introduced
- secrets or credentials
- a practical way to bypass posting controls at scale
- cross-site scripting or injection
- infrastructure takeover

Use GitHub's private vulnerability reporting feature for this repository if it is available.

If private reporting is not available, contact the repository owner privately through the contact method on the owner's GitHub profile.

## What to include

A useful report contains:

- affected URL / endpoint
- reproduction steps
- impact
- whether the issue is reliably repeatable
- any proof-of-concept needed to understand the problem

Please avoid accessing data that is not yours or causing unnecessary disruption while testing.

## Current security posture

The product currently uses:

- Cloudflare Workers
- Cloudflare D1
- React escaping for rendered text
- server-side validation for community posts
- email / HTTP(S)-only contact validation
- a hidden honeypot
- hashed connection fingerprints for posting throttles
- automatic cleanup of throttle records
- no raw-IP persistence for posting throttles

This document is not a claim that the project is vulnerability-free.
