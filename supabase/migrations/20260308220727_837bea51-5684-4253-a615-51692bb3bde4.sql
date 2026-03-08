
CREATE TABLE public.placements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  intern_id UUID NOT NULL REFERENCES public.interns(id) ON DELETE CASCADE,
  worksite_id UUID NOT NULL REFERENCES public.worksites(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(intern_id)
);

ALTER TABLE public.placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to placements" ON public.placements FOR ALL USING (true) WITH CHECK (true);
