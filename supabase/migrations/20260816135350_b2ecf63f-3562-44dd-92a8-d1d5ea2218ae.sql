CREATE POLICY "photographer manages own sunbomedia files"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'sunbomedia' AND (storage.foldername(name))[1] = (auth.uid())::text)
WITH CHECK (bucket_id = 'sunbomedia' AND (storage.foldername(name))[1] = (auth.uid())::text);