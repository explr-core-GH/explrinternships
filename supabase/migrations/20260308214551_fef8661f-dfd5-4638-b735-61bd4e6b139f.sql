
-- Create interns table
CREATE TABLE public.interns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email_submission TEXT,
  student_email TEXT,
  phone TEXT,
  parent_phone TEXT,
  dob TEXT,
  school TEXT,
  other_school TEXT,
  grade TEXT,
  programs TEXT[] DEFAULT '{}',
  it_interests TEXT[] DEFAULT '{}',
  cleveland_clinic TEXT DEFAULT '',
  construction_mgmt TEXT DEFAULT '',
  biomedical TEXT DEFAULT '',
  env_justice TEXT DEFAULT '',
  env_climate TEXT DEFAULT '',
  env_field_science TEXT DEFAULT '',
  iers_center TEXT DEFAULT '',
  magnet_manufacturing TEXT DEFAULT '',
  education_internship TEXT DEFAULT '',
  healthcare TEXT DEFAULT '',
  video_games TEXT DEFAULT '',
  cs_course_taken TEXT DEFAULT '',
  specific_interests TEXT DEFAULT '',
  additional_questions TEXT DEFAULT '',
  is_duplicate BOOLEAN DEFAULT false,
  is_newest BOOLEAN DEFAULT true,
  timestamp TEXT,
  source_sheet_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create worksites table
CREATE TABLE public.worksites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT DEFAULT '',
  capacity INTEGER DEFAULT 6,
  filled INTEGER DEFAULT 0,
  contact_name TEXT DEFAULT '',
  contact_email TEXT DEFAULT '',
  location TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sync_config table to store Google Sheet URL
CREATE TABLE public.sync_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sheet_url TEXT NOT NULL,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.interns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worksites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_config ENABLE ROW LEVEL SECURITY;

-- For now allow public read/write (internal app, no auth yet)
CREATE POLICY "Allow all access to interns" ON public.interns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to worksites" ON public.worksites FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to sync_config" ON public.sync_config FOR ALL USING (true) WITH CHECK (true);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_interns_updated_at BEFORE UPDATE ON public.interns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_worksites_updated_at BEFORE UPDATE ON public.worksites FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
