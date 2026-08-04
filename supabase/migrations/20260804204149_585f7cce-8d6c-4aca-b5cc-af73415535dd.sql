CREATE POLICY "photographer manages own preview files" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'previews' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'previews' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "photographer manages own original files" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'originals' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'originals' AND (storage.foldername(name))[1] = auth.uid()::text);