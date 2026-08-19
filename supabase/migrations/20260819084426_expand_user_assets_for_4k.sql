-- Gemini 4K PNG responses can exceed the original 12 MiB bucket limit.
-- Keep this below the Free-plan 50 MB global ceiling while allowing the
-- browser to persist the original when WebP optimization is unavailable.
update storage.buckets
set file_size_limit = 41943040
where id = 'user-assets';
