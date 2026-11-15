DO $$ DECLARE a uuid; b uuid; pr uuid; pending uuid; pe uuid; BEGIN
IF EXISTS(SELECT 1 FROM agreements WHERE code='DEMO-FOREST') THEN RETURN; END IF;
IF EXISTS(SELECT 1 FROM agreements) THEN RAISE EXCEPTION 'Demo seed requires empty domain data'; END IF;
INSERT INTO agreements(code,name,licensor,property,territory,category,currency,starts_on,ends_on,rate_bps,minimum_cents,advance_cents,owner,evidence,tax_year_end,retain_until,review_on)
VALUES('DEMO-FOREST','Forest Friends Drinkware','Imaginary Forest Studio','Forest Friends','NZ','drinkware','NZD',current_date-180,current_date+40,800,1200000,400000,'Mira','DEMO signed agreement A',date '2027-03-31',date '2034-03-31',current_date-5) RETURNING id INTO a;
INSERT INTO agreements(code,name,licensor,property,territory,category,currency,starts_on,ends_on,rate_bps,minimum_cents,advance_cents,owner,evidence,review_on)
VALUES('DEMO-FOREST-AU','Forest Friends Bags','Imaginary Forest Studio','Forest Friends','AU','bags','AUD',current_date-180,current_date+200,1000,500000,100000,'Tane','DEMO signed agreement B',current_date+60) RETURNING id INTO b;
INSERT INTO products(agreement_id,code,name,approved_on,approval_evidence) VALUES(a,'CUP-01','Forest enamel cup',current_date-100,'DEMO artwork approval 12') RETURNING id INTO pr;
INSERT INTO products(agreement_id,code,name) VALUES(a,'CUP-02','Forest travel cup') RETURNING id INTO pending;
INSERT INTO products(agreement_id,code,name,approved_on,approval_evidence) VALUES(b,'BAG-01','Forest tote',current_date-100,'DEMO artwork approval 21');
INSERT INTO periods(agreement_id,code,starts_on,ends_on,due_on,preparer) VALUES(a,'DEMO-Q1',current_date-90,current_date-31,current_date-10,'Mira') RETURNING id INTO pe;
INSERT INTO sales(period_id,product_id,reference,sold_on,territory,currency,gross_cents,deductions_cents,source_evidence) VALUES
(pe,pr,'INV-101/1',current_date-50,'NZ','NZD',2000000,100000,'DEMO sales report 101'),
(pe,pr,'INV-102/1',current_date-45,'AU','NZD',300000,0,'DEMO territory exception'),
(pe,pending,'INV-103/1',current_date-40,'NZ','NZD',200000,0,'DEMO approval exception');
INSERT INTO periods(agreement_id,code,starts_on,ends_on,due_on,preparer) VALUES(a,'DEMO-Q2',current_date-30,current_date+30,current_date+45,'Mira') RETURNING id INTO pe;
INSERT INTO sales(period_id,product_id,reference,sold_on,territory,currency,gross_cents,deductions_cents,source_evidence) VALUES(pe,pr,'INV-104/1',current_date-5,'NZ','NZD',1000000,0,'DEMO sales report 104');
INSERT INTO followups(agreement_id,note,owner,due_on) VALUES(a,'Obtain travel cup approval evidence','Mira',current_date-3),(b,'Confirm renewal terms','Tane',current_date+10);
END $$;
