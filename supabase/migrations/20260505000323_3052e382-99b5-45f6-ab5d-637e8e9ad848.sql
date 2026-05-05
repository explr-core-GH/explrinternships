ALTER TABLE public.worksites
  ADD COLUMN IF NOT EXISTS interest_field_keys text[] NOT NULL DEFAULT '{}';

UPDATE public.worksites SET interest_field_keys = ARRAY['constructionMgmt']
  WHERE interest_field_keys = '{}' AND name ILIKE '%construction management%';

UPDATE public.worksites SET interest_field_keys = ARRAY['biomedical']
  WHERE interest_field_keys = '{}' AND name ILIKE '%biomedical%';

UPDATE public.worksites SET interest_field_keys = ARRAY['envJustice']
  WHERE interest_field_keys = '{}' AND name ILIKE '%environmental justice%';

UPDATE public.worksites SET interest_field_keys = ARRAY['envClimate']
  WHERE interest_field_keys = '{}' AND (name ILIKE '%climate%' OR name ILIKE '%resilience%');

UPDATE public.worksites SET interest_field_keys = ARRAY['envFieldScience']
  WHERE interest_field_keys = '{}' AND name ILIKE '%field science%';

UPDATE public.worksites SET interest_field_keys = ARRAY['magnetManufacturing']
  WHERE interest_field_keys = '{}' AND name ILIKE '%magnet%';

UPDATE public.worksites SET interest_field_keys = ARRAY['iersCenter']
  WHERE interest_field_keys = '{}' AND name ILIKE '%iers%';

UPDATE public.worksites SET interest_field_keys = ARRAY['educationInternship']
  WHERE interest_field_keys = '{}' AND name ILIKE '%stem education%';

UPDATE public.worksites SET interest_field_keys = ARRAY['healthcare']
  WHERE interest_field_keys = '{}' AND name ILIKE '%healthcare careers%';

UPDATE public.worksites SET interest_field_keys = ARRAY['clevelandClinic', 'healthcare']
  WHERE interest_field_keys = '{}' AND name ILIKE '%cleveland clinic%';

UPDATE public.worksites SET interest_field_keys = ARRAY['videoGames']
  WHERE interest_field_keys = '{}' AND (name ILIKE '%game%' OR name ILIKE '%app design%');