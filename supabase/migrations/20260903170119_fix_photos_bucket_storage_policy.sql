-- The storage bucket is actually named "photos" (not "originals" as the
-- earlier migration assumed), so the RLS policy created for 'originals'
-- never matched anything and the bucket had no photographer-scoped policy.
DROP POLICY IF EXISTS "photographer manages own original files" ON storage.objects;

CREATE POLICY "photographer manages own photo files" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);
