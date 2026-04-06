CREATE TABLE public.school_aliases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alias TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(alias)
);

ALTER TABLE public.school_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to school_aliases"
  ON public.school_aliases FOR ALL
  USING (true)
  WITH CHECK (true);