-- Add the other leg without changing existing sponsor ownership.
-- Do not delete this row on rollback once orders reference it.
INSERT INTO public.slowrun_slots (id) VALUES (9) ON CONFLICT (id) DO NOTHING;
