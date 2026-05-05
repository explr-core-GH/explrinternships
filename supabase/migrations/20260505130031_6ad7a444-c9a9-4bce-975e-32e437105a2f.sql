ALTER TABLE public.interns
  ADD COLUMN IF NOT EXISTS journalism text DEFAULT ''::text,
  ADD COLUMN IF NOT EXISTS bike_program text DEFAULT ''::text,
  ADD COLUMN IF NOT EXISTS it_certification text DEFAULT ''::text;