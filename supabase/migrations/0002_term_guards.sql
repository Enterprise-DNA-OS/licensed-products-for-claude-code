CREATE FUNCTION guard_agreement() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM periods WHERE agreement_id=OLD.id) AND
 (to_jsonb(NEW)-'tax_year_end'-'retain_until'-'review_on'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'tax_year_end'-'retain_until'-'review_on'-'updated_at')
 THEN RAISE EXCEPTION 'Agreement terms are frozen after a reporting period exists; use a reviewed amendment'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER agreement_guard BEFORE UPDATE ON agreements FOR EACH ROW EXECUTE FUNCTION guard_agreement();
CREATE FUNCTION guard_product() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 PERFORM id FROM agreements WHERE id=OLD.agreement_id FOR UPDATE;
 IF (NEW.agreement_id,NEW.code,NEW.name) IS DISTINCT FROM (OLD.agreement_id,OLD.code,OLD.name) THEN RAISE EXCEPTION 'Product identity is frozen'; END IF;
 IF OLD.approved_on IS NOT NULL THEN RAISE EXCEPTION 'Approval evidence is frozen'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER product_guard BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION guard_product();
