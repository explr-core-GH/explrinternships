
ALTER TABLE public.sync_config ADD CONSTRAINT sync_config_sheet_url_unique UNIQUE (sheet_url);
