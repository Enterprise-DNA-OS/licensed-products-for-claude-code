# Bring LicenSee sales history across

The vendor [datasheet](https://fadel.com/wp-content/uploads/2026/03/LicenSee-Datasheet.pdf) documents spreadsheet-based sales intake and statement generation. It does not publish a full-account CSV export schema. This importer is an explicit sales mapping, not a claim to understand an undocumented native export.

1. Keep the source sales workbook used for LicenSee and obtain the contract, product approvals and existing statements from your controlled records. Ask the vendor for account exports if those source files are unavailable. Do not cancel access before obtaining and reconciling them.
2. Record one agreement per property, country, category, currency and fixed royalty rate from the signed terms. Enter the products and their dated approvals, then a non-overlapping reporting period. Agreements cannot change economic terms after a period exists.
3. Save the relevant sales worksheet as UTF-8 CSV, one row per invoice line. Map its headers with a JSON mapping file. Dates must be ISO YYYY-MM-DD. Money fields must be integer cents. Prepare the conversion explicitly; the importer never guesses currency, decimals or date order.
4. Validate, import, then reconcile counts, gross sales, deductions, net sales, excluded rows and earned royalties against the source workbook and existing statement.

```sh
npm run licensing -- import licensee --period=YOUR-PERIOD --file=imports/sales.csv --map=imports/columns.json --dry-run --actor=YourName
npm run licensing -- import licensee --period=YOUR-PERIOD --file=imports/sales.csv --map=imports/columns.json --actor=YourName
npm run licensing -- period --period=YOUR-PERIOD --json
```

The second line is the one-command import after the mapping and contract setup. The first line rolls back every write, including the original-file record and activity. A real export has not been tested in this build. The fixture is invented and demonstrates the accepted mapping, not a captured vendor file.

## Mapping

| Field | Default column names | Meaning |
|---|---|---|
| product | Product, SKU, Product Code | Existing product code within the period's agreement |
| reference | Reference, Sales Reference, Invoice Line | Stable unique invoice-line reference within the reporting period |
| date | Sale Date, Date | ISO sale date within the reporting period |
| territory | Territory, Country | Two-letter country code; mismatches become exceptions |
| currency | Currency | Currency of the source sale; mismatches become exceptions |
| gross-cents | Gross Cents | Nonnegative gross sale, integer cents |
| deductions-cents | Deductions Cents | Allowed deductions, integer cents; blank becomes zero |
| evidence | Evidence, Source Reference | Source document reference |

Example custom mapping: `{"product":"Our SKU","reference":"Invoice Line ID"}`. Mapping keys are exactly the fields above. Preserve leading zeroes in invoice and product identifiers.

Original CSV, mapping, file digest, actor and every extra column are retained. Re-importing identical bytes with the same mapping and period does nothing. Changed bytes with an existing reference are rejected as a whole; live work is never overwritten. A malformed row rolls back the whole file. Wrong-country, wrong-currency and unapproved-product rows remain visible as exceptions but cannot enter a closed statement. Void an incorrect open-period sale with a reason, then enter a corrected row under a new reference.

## What does not transfer automatically

LicenSee contract configuration, amendments, product artwork, attachments, workflow approvals, authentication, proprietary licensor statement formats, payment history, commission rules and tiered royalty calculations do not transfer through this sales import. Existing statements remain source evidence; importing sales does not mark them reviewed or sent. There is no automatic portal connection or sending.

Enterprise DNA maps the source records, implements the required terms and statement layouts, and checks the reconciliation as part of the custom version. Keep both systems available until the operator signs off a complete reporting cycle. A switch in a day is feasible for a prepared flat-rate ledger; a complex contract migration needs its own scope.

## Backups

`npm run licensing -- export --out=exports/backup.json` writes a new JSON snapshot of every domain record, original imports, frozen statements and activity. Create the exports folder first. It refuses to overwrite an existing file. Use native database backups too. Restore is a reviewed maintenance operation; there is no automatic restore command.
