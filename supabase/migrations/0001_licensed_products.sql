CREATE TABLE agreements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE CHECK(btrim(code)<>''), name text NOT NULL CHECK(btrim(name)<>''),
 licensor text NOT NULL, property text NOT NULL, territory text NOT NULL CHECK(territory ~ '^[A-Z]{2}$'), category text NOT NULL,
 currency text NOT NULL CHECK(currency IN ('NZD','AUD','USD','GBP','EUR')), starts_on date NOT NULL, ends_on date NOT NULL,
 rate_bps integer NOT NULL CHECK(rate_bps BETWEEN 0 AND 10000), minimum_cents bigint NOT NULL DEFAULT 0 CHECK(minimum_cents BETWEEN 0 AND 1000000000000),
 advance_cents bigint NOT NULL DEFAULT 0 CHECK(advance_cents BETWEEN 0 AND 1000000000000), owner text NOT NULL,
 evidence text NOT NULL, tax_year_end date, retain_until date, review_on date NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CHECK(ends_on>=starts_on)
);
CREATE TABLE products (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), agreement_id uuid NOT NULL REFERENCES agreements(id), code text NOT NULL, name text NOT NULL,
 approved_on date, approval_evidence text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(agreement_id,code), CHECK((approved_on IS NULL AND approval_evidence IS NULL) OR (approved_on IS NOT NULL AND length(btrim(approval_evidence))>0))
);
CREATE TABLE periods (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), agreement_id uuid NOT NULL REFERENCES agreements(id), code text NOT NULL UNIQUE,
 starts_on date NOT NULL, ends_on date NOT NULL, due_on date NOT NULL, preparer text NOT NULL,
 closed_at timestamptz, reviewer text, reconciliation text, snapshot jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CHECK(ends_on>=starts_on), CHECK(due_on>=ends_on),
 CHECK((closed_at IS NULL AND snapshot IS NULL AND reviewer IS NULL) OR (closed_at IS NOT NULL AND snapshot IS NOT NULL AND reviewer IS NOT NULL AND reviewer<>preparer AND length(btrim(reconciliation))>0))
);
CREATE TABLE imports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), digest text NOT NULL UNIQUE, original_csv text NOT NULL, mapping jsonb NOT NULL, actor text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sales (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), period_id uuid NOT NULL REFERENCES periods(id), product_id uuid NOT NULL REFERENCES products(id),
 reference text NOT NULL, sold_on date NOT NULL, territory text NOT NULL CHECK(territory ~ '^[A-Z]{2}$'), currency text NOT NULL,
 gross_cents bigint NOT NULL CHECK(gross_cents BETWEEN 0 AND 1000000000000), deductions_cents bigint NOT NULL DEFAULT 0 CHECK(deductions_cents BETWEEN 0 AND gross_cents),
 source_evidence text NOT NULL CHECK(length(btrim(source_evidence))>0), import_id uuid REFERENCES imports(id), source_row jsonb NOT NULL DEFAULT '{}',
 void_reason text, voided_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(period_id,reference), CHECK((voided_at IS NULL AND void_reason IS NULL) OR (voided_at IS NOT NULL AND length(btrim(void_reason))>0))
);
CREATE TABLE followups (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), agreement_id uuid NOT NULL REFERENCES agreements(id), note text NOT NULL, owner text NOT NULL, due_on date NOT NULL,
 resolution text, closed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((closed_at IS NULL AND resolution IS NULL) OR (closed_at IS NOT NULL AND length(btrim(resolution))>0))
);
CREATE TABLE activity (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL, record_id uuid NOT NULL, actor text NOT NULL, detail jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION touch_updated() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE FUNCTION immutable_record() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION '% records are append-only',TG_TABLE_NAME; END $$;
CREATE FUNCTION guard_period() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 PERFORM id FROM agreements WHERE id=NEW.agreement_id FOR UPDATE;
 IF TG_OP='UPDATE' AND OLD.closed_at IS NOT NULL THEN RAISE EXCEPTION 'Closed period is frozen'; END IF;
 IF TG_OP='INSERT' AND EXISTS(SELECT 1 FROM periods WHERE agreement_id=NEW.agreement_id AND starts_on<=NEW.ends_on AND ends_on>=NEW.starts_on) THEN RAISE EXCEPTION 'Reporting periods overlap'; END IF;
 IF TG_OP='UPDATE' AND (NEW.agreement_id,NEW.code,NEW.starts_on,NEW.ends_on,NEW.due_on,NEW.preparer) IS DISTINCT FROM (OLD.agreement_id,OLD.code,OLD.starts_on,OLD.ends_on,OLD.due_on,OLD.preparer) THEN RAISE EXCEPTION 'Period definition is immutable'; END IF;
 RETURN NEW; END $$;
CREATE FUNCTION guard_sale() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE p periods; prod products; BEGIN
 SELECT * INTO p FROM periods WHERE id=NEW.period_id;
 PERFORM id FROM agreements WHERE id=p.agreement_id FOR UPDATE;
 SELECT * INTO p FROM periods WHERE id=NEW.period_id;
 IF p.closed_at IS NOT NULL THEN RAISE EXCEPTION 'Closed period is frozen'; END IF;
 SELECT * INTO prod FROM products WHERE id=NEW.product_id;
 IF prod.agreement_id<>p.agreement_id THEN RAISE EXCEPTION 'Product belongs to another agreement'; END IF;
 IF NEW.sold_on<p.starts_on OR NEW.sold_on>p.ends_on THEN RAISE EXCEPTION 'Sale outside reporting period'; END IF;
 IF TG_OP='UPDATE' AND (to_jsonb(NEW)-'voided_at'-'void_reason'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'voided_at'-'void_reason'-'updated_at') THEN RAISE EXCEPTION 'Sales are immutable; void and replace'; END IF;
 IF TG_OP='UPDATE' AND (OLD.voided_at IS NOT NULL OR NEW.voided_at IS NULL) THEN RAISE EXCEPTION 'Only a first void is allowed'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER period_guard BEFORE INSERT OR UPDATE ON periods FOR EACH ROW EXECUTE FUNCTION guard_period();
CREATE TRIGGER sale_guard BEFORE INSERT OR UPDATE ON sales FOR EACH ROW EXECUTE FUNCTION guard_sale();
DO $$ DECLARE n text; BEGIN
 FOREACH n IN ARRAY ARRAY['agreements','products','periods','imports','sales','followups','activity'] LOOP
 EXECUTE format('CREATE TRIGGER touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated()',n);
 EXECUTE format('CREATE TRIGGER no_delete BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION immutable_record()',n);
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',n);
 EXECUTE format('REVOKE ALL ON %I FROM PUBLIC',n);
 END LOOP;
 FOREACH n IN ARRAY ARRAY['imports','activity'] LOOP
 EXECUTE format('CREATE TRIGGER no_update BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION immutable_record()',n);
 END LOOP; END $$;
CREATE VIEW sale_review AS
SELECT s.id,s.period_id,s.product_id,p.agreement_id,p.code AS period,a.code AS agreement,s.reference,pr.code AS product,s.sold_on,
 s.territory,s.currency,s.gross_cents,s.deductions_cents,(s.gross_cents-s.deductions_cents) AS net_cents,
 round((s.gross_cents-s.deductions_cents)::numeric*a.rate_bps/10000)::bigint AS royalty_cents,
 concat_ws('; ',CASE WHEN s.territory<>a.territory THEN 'territory outside licence' END,
 CASE WHEN s.currency<>a.currency THEN 'currency mismatch' END,
 CASE WHEN s.sold_on<a.starts_on OR s.sold_on>a.ends_on THEN 'sale outside licence term' END,
 CASE WHEN pr.approved_on IS NULL OR pr.approved_on>s.sold_on THEN 'product not approved at sale date' END,
 CASE WHEN btrim(a.evidence)='' THEN 'signed agreement evidence missing' END) AS issue
FROM sales s JOIN periods p ON p.id=s.period_id JOIN agreements a ON a.id=p.agreement_id JOIN products pr ON pr.id=s.product_id WHERE s.voided_at IS NULL;
CREATE VIEW period_position AS
SELECT p.id,p.agreement_id,p.code,a.code AS agreement,a.currency,p.starts_on,p.ends_on,p.due_on,p.preparer,p.closed_at,
 count(s.id)::integer AS sale_count,count(s.id) FILTER(WHERE s.issue<>'')::integer AS exception_count,
 coalesce(sum(s.net_cents) FILTER(WHERE s.issue=''),0)::bigint AS eligible_net_cents,
 coalesce(sum(s.royalty_cents) FILTER(WHERE s.issue=''),0)::bigint AS earned_cents,
 CASE WHEN p.closed_at IS NOT NULL THEN 'closed' WHEN p.due_on<current_date THEN 'overdue' ELSE 'open' END AS status
FROM periods p JOIN agreements a ON a.id=p.agreement_id LEFT JOIN sale_review s ON s.period_id=p.id GROUP BY p.id,p.agreement_id,p.code,a.code,a.currency,p.starts_on,p.ends_on,p.due_on,p.preparer,p.closed_at;
CREATE VIEW guarantee_position AS
SELECT a.id,a.code,a.name,a.currency,a.minimum_cents,a.advance_cents,
 coalesce(sum(p.earned_cents),0)::bigint AS earned_cents,
 greatest(a.minimum_cents-coalesce(sum(p.earned_cents),0),0)::bigint AS guarantee_gap_cents,
 greatest(coalesce(sum(p.earned_cents),0)-a.advance_cents,0)::bigint AS earned_above_advance_cents,
 coalesce(sum(p.exception_count),0)::integer AS unresolved_sales
FROM agreements a LEFT JOIN period_position p ON p.agreement_id=a.id GROUP BY a.id,a.code,a.name,a.currency,a.minimum_cents,a.advance_cents;
CREATE VIEW compliance_findings AS
SELECT id AS record_id,code AS record,'AGREEMENT-EVIDENCE' AS rule,'Signed agreement evidence missing' AS finding FROM agreements WHERE btrim(evidence)=''
UNION ALL SELECT id,code,'NZ-TAX-RETENTION','Set tax year end and retain-until date from the agreed NZ record policy' FROM agreements WHERE tax_year_end IS NULL OR retain_until IS NULL
UNION ALL SELECT id,code,'NZ-TAX-MINIMUM','Retain-until date is earlier than seven years after the recorded tax year end' FROM agreements WHERE retain_until<(tax_year_end+interval '7 years')::date
UNION ALL SELECT id,code,'NZ-PRIVACY-REVIEW','Review the need for licensor personal details; no automatic disposal' FROM agreements WHERE review_on<=current_date
UNION ALL SELECT id,reference,'CONTRACT-SALE',issue FROM sale_review WHERE issue<>'';
