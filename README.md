# Licensed Products for Claude Code

Keep licensed-product agreements, approved products, sales and royalty reviews in a database you own. Spot the sale outside its territory before it reaches a statement.

## Three ways to own it

- **Do it yourself:** free, MIT licensed. Run it with Claude Code, Codex, OpenCode or Cursor. Hosting and your agent subscription are separate costs.
- **We customise it:** Enterprise DNA maps your FADEL LicenSee source records, adds your contract rules and statement layouts, and builds a web front end or uses a different stack when needed. One setup fee, then a retainer for ongoing work.
- **We run it for you:** Omni by Enterprise DNA installs it, connects your systems, manages access and backups, and prepares the reporting cycle. One setup fee, then a retainer.

[Book a 30-minute call with Sam](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=fadel-licensee).

## Quick start

Node 20 or newer. No cloud account required.

```sh
npm install
npm test
npm run demo
npm run licensing -- sales-exceptions
npm run licensing -- royalty-review --json
npm run view
npm run docs
```

The synthetic demo includes an overdue reporting period, an out-of-territory sale, an unapproved product and a stale action. Reseeding preserves edits. Use an empty DATA_DIR for real data and never seed it. Set DATABASE_URL for a shared PostgreSQL database or leave it empty for local PGlite in .data/db.

## What this base covers

One agreement holds one property, country, product category, currency and flat royalty rate. Products have dated approval evidence. Reporting periods cannot overlap. Sales retain their source reference and original imported row. Gross less allowed deductions produces net sales; eligible lines earn the fixed percentage, rounded to cents per line. Currencies never aggregate together.

Wrong-country, wrong-currency, out-of-term and unapproved-product sales appear as exceptions. They stay outside earned totals and block period closure. Closing requires a different named reviewer and reconciliation evidence, and freezes the statement snapshot. Open-period mistakes can be voided with a reason; records are never deleted. Original import files and activity are append-only.

Whole-term minimum exposure and earned royalties above a recorded advance are working comparisons, not payment amounts. No tiered rates, credit-note processing, tax, commission, currency conversion, settlement, licensor portal, vendor-specific statement layout or automatic payment is included. Add and test the relevant contract terms before relying on those calculations. Closed-period corrections need a reviewed amendment that preserves the original.

[Research](docs/research.md) records the five-figure company-reported annual contract range and its limits. No NZ/AU customer invoice or local subscriber was verified. This is an independent implementation of the bounded workflow, not the full FADEL platform.

## Commands

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

28 executable CLI commands and 30 slash commands. All CLI commands support --json. Flags use --name=value. Exact codes take precedence; partial ids and case-insensitive names work, and ambiguous matches list candidates and exit 1.

## Ten questions your own records answer

1. Which reporting periods are overdue and still contain exceptions?
2. Which sales were made outside the licensed territory?
3. Which products were sold before their approval date?
4. Which sales use a different currency from the agreement?
5. How much eligible royalty has each period earned?
6. How much of each whole-term minimum remains unearned?
7. Which licences expire in the next sixty days?
8. Which follow-ups are overdue and who owns them?
9. Which licence records need a retention or purpose review?
10. Which sales and evidence supported a closed statement?

These are demonstrated queries, not a claim that FADEL cannot answer them. Your own joins, policy and evidence remain available to change.

## Your first hour: ten things to ask for

1. Put our name, colours and logo in brand.json.
2. Show overdue reporting periods.
3. Explain each excluded sales line.
4. Show products still waiting for approval evidence.
5. Show unearned minimums without mixing currencies.
6. Draft the Monday review from deadlines, exceptions and actions.
7. Draft a royalty working statement for one period.
8. Test our source-sales mapping and reconcile every total.
9. Add our contract manager field with a tested migration.
10. Export a private snapshot before changing a rule.

## Bring your history

[The replace guide](docs/replace-fadel-licensee.md) covers mapping your source sales worksheet, recording signed terms, validating and importing with one command, and reconciling the result. There is no published full-account export schema in the vendor material reviewed. The synthetic fixture is our accepted mapping contract. Extra columns and the original CSV remain in the database. Duplicate files do nothing; duplicate references in changed files fail atomically.

## Documents, views and operations

brand.json controls the business name, logo and colours. npm run view renders the week, licence exposure and evidence review. npm run docs renders licence briefs, royalty working statements and evidence checklists as private HTML. These are drafts and working records, not official licensor submissions. [Why no front end](docs/why-no-front-end.md) explains mobile, portal and shared-editing limits.

[Compliance](docs/compliance.md) links the NZ record-keeping and privacy sources and explains contract checks. Checks identify review work; they do not certify legal compliance. The Australian record policy requires configuration.

All domain tables have row-level security enabled and PUBLIC privileges revoked. The connection is a trusted owner, and actor names are labels rather than authentication. Database owners can bypass controls. Use OS and database permissions and native backups. JSON export includes all domain records, imports, activity and frozen statements; restore is a reviewed maintenance task.

npm test uses a temporary database and output directory, exercises every command, validates money arithmetic and guards, tests atomic imports, snapshots, HTML escaping and ambiguity. CI is configured for Windows and Ubuntu on Node 20 and 22 and PostgreSQL 16. Observed results are recorded separately; configuration alone is not a passing run. TEST_DATABASE_URL must point to an empty disposable database.

## Licence

MIT. Copyright 2026 Enterprise DNA. FADEL and LicenSee belong to their owners. No vendor code or assets are included.
