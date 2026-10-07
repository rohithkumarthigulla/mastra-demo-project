DROP INDEX "equipment_specifications_definition_id_idx";--> statement-breakpoint
CREATE INDEX "equipment_specifications_definition_normalized_min_idx" ON "equipment_specifications" USING btree ("definition_id","normalized_min");--> statement-breakpoint
CREATE INDEX "equipment_specifications_definition_normalized_max_idx" ON "equipment_specifications" USING btree ("definition_id","normalized_max");