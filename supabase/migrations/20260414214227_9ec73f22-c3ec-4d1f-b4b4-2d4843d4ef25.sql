
ALTER TABLE public.interns ADD COLUMN IF NOT EXISTS race_ethnicity text DEFAULT NULL;
ALTER TABLE public.interns ADD COLUMN IF NOT EXISTS parent_guardian_email text DEFAULT NULL;
ALTER TABLE public.interns ADD COLUMN IF NOT EXISTS parent_guardian_phone text DEFAULT NULL;
