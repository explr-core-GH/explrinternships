
-- Create school contacts table
CREATE TABLE public.school_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('principal', 'guidance_counselor', '5c')),
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.school_contacts ENABLE ROW LEVEL SECURITY;

-- Allow all access (matches existing app pattern)
CREATE POLICY "Allow all access to school_contacts"
  ON public.school_contacts
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for fast lookup by school name
CREATE INDEX idx_school_contacts_school ON public.school_contacts (school_name);

-- Timestamp trigger
CREATE TRIGGER update_school_contacts_updated_at
  BEFORE UPDATE ON public.school_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
