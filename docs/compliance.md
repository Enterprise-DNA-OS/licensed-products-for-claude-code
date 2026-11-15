# Record checks and their sources

Checked 15 November 2026. These checks surface missing evidence and internal review work. They do not certify a licence, decide ownership, calculate tax or submit a statement.

| Rule | Implemented check | Source and limit |
|---|---|---|
| AGREEMENT-EVIDENCE | Flag missing signed-contract evidence. | The operator's signed agreement is the source of permission. This is an internal evidence policy, not a statutory signature rule. |
| CONTRACT-SALE | Compare country, currency, sale date and product approval date with the entered licence. Exclude exceptions from eligible royalties and block closing. | The entered contract and product approval are the source. Country and category are specific to one agreement. No inference of rights from a product name. |
| NZ-TAX-RETENTION | Flag absent tax year end or retention date. | [Inland Revenue record keeping](https://www.ird.govt.nz/managing-my-tax/record-keeping) requires at least seven tax years. |
| NZ-TAX-MINIMUM | Flag retention before seven years after the recorded tax year end. | Same source. An operator must set the correct final applicable tax year, extend for holds and review later transactions. This is a metadata check, not verification that documents still exist. |
| NZ-PRIVACY-REVIEW | Flag a due review of licensor personal details. | [Privacy principle 9](https://www.privacy.org.nz/privacy-principles/9/) limits retention to the lawful purpose. Review timing is an internal policy, not a statutory deadline. No automatic deletion. |

The included retention profile is for New Zealand. Australian and other operators must configure their record policy before relying on these findings. Contract requirements can impose longer retention. Do not attach unnecessary personal data to sales references.

Every mutation has a named actor and activity record. Actor names are operator-supplied labels, not authenticated identities. The connection is a trusted database owner. Row-level security and revoked PUBLIC privileges prevent accidental exposure through an unprivileged connection; they do not build a multi-user approval system. Database owners can bypass controls.

The base calculates a single flat percentage of eligible net sales for each agreement, rounded to the nearest cent on each line. Deductions must be nonnegative and no greater than gross sales. Negative credit notes, tiered rates, minimum per-unit royalties, cross-collateralisation, tax, commissions, foreign-exchange conversion and payment execution are outside this model. Add and test the contract-specific calculation before using such terms.

Guarantee exposure is the unearned portion of a whole-term minimum. Earned above advance is a comparison of cumulative earned royalties and the recorded advance. Neither is a payable balance, a recoupment schedule, a guarantee settlement or an accounting entry. No royalty payment is made here.

Product approvals must be recorded from dated evidence. Backdating a label without evidence is not approval. Closing requires another actor, completed sales-exception review and a reconciliation note. This tool records that review; it cannot establish that the human actually checked the source. Closed snapshots and sales are frozen. Correct a closed statement through a separately reviewed amendment migration, preserving the original.
