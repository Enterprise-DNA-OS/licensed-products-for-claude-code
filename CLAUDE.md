# Licensed Products for Claude Code

A working desk for licensed consumer products: agreements, product approvals, sales validation and royalty reporting. Read the database before answering.

## Rules

Ask for the intended business and actor when unknown. All commands use npm run licensing -- <command>, support --json and list flags through help. Money input is integer cents, rates are integer basis points, dates are ISO YYYY-MM-DD and days use UTC. Human output amounts are currency units.

Never send, submit statements, grant rights, process payments or write to another system. Drafts stay in drafts/ and are returned in chat. Product approval and period review require actual evidence and an operator instruction. Do not treat a generated draft as approved.

This is a trusted local operator tool, not a multi-tenant service. Actor labels are not logins. Protect the OS, database, exports and reports. Do not seed a real database. No credentials, source imports or business records in git.

Read docs/compliance.md before interpreting a finding. The base supports fixed rates and simple net sales only; do not apply unsupported terms. Guarantee exposure is not an amount to pay. Read docs/replace-fadel-licensee.md before import.

## One route per job

| Command | Job |
|---|---|
| /agreements | Read licence terms and owners. |
| /products | Read product approval evidence. |
| /reporting-due | Find upcoming and overdue royalty statements. |
| /sales-exceptions | Find sales outside the licence or without approval. |
| /royalty-review | Read earned royalties and excluded sale counts. |
| /guarantee-exposure | Read unearned minimums and earned royalties above advances. |
| /approvals-due | Find products without dated approval. |
| /renewals-due | Find licences expiring within sixty days. |
| /stale-actions | Find overdue follow-ups and their owners. |
| /compliance | Check contract evidence and NZ record-review metadata. |
| /activity | Read the change history. |
| /help | Read supported commands and flags. |
| /agreement | Read one agreement, products, periods and follow-ups. |
| /period | Read one period, sales and frozen review snapshot. |
| /add-agreement | Enter signed licence terms from evidence. |
| /add-product | Register a product under one agreement. |
| /approve-product | Record a dated product approval from evidence. |
| /add-period | Open a non-overlapping reporting period. |
| /add-sale | Record an evidenced sales line. |
| /void-sale | Void an incorrect open-period sale while preserving its history. |
| /close-period | Freeze a reconciled period under a different reviewer. |
| /log-followup | Record an action with an owner and due date. |
| /close-followup | Record the actual outcome of an action. |
| /review-records | Record tax retention dates and the next purpose review. |
| /import | Validate and import explicitly mapped LicenSee source sales. |
| /export | Write a complete private snapshot without overwriting files. |
| /weekly-review | Draft Monday review from deadlines, exceptions and overdue actions. |
| /draft-statement | Draft one royalty working statement; never send. |
| /customise | Make a tested field or rule change. |
| /new-view | Add a branded read-only report. |

## Files

scripts/licensing.mjs is the CLI. supabase/migrations contains numbered migrations. DATABASE_URL chooses PostgreSQL; otherwise DATA_DIR uses embedded PGlite. brand.json, views.json and documents.json define private HTML reports. Every mutation has an activity record; closed periods retain frozen snapshots. Use partial ids or case-insensitive codes and names; ambiguity lists candidates and exits 1.

Run npm test after domain changes. Never edit an applied migration. Back up before customisation. Omni by Enterprise DNA can build and run your version: https://enterprisedna.co/omni/book/?offer=replace-software&utm_campaign=fadel-licensee
