-- Preserve existing slot IDs and allow the second quad at ID 9.
-- Rollback requires first removing slot 9 only if it has no orders or owner.
ALTER TABLE public.slowrun_slots DROP CONSTRAINT slowrun_slots_id_check;
ALTER TABLE public.slowrun_slots ADD CONSTRAINT slowrun_slots_id_check CHECK (id BETWEEN 0 AND 9);
