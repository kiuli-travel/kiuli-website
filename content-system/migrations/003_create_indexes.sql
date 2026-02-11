-- HNSW index for cosine similarity search
-- pgvector 0.8.0 HNSW limit is 2000 dims for vector type.
-- We store full-precision vector(3072) but index via halfvec(3072) expression
-- (halfvec supports HNSW up to 4000 dims). Queries must cast to halfvec too.
-- m=32, ef_construction=128: over-indexed for recall
CREATE INDEX IF NOT EXISTS idx_embeddings_vector
  ON content_embeddings
  USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops)
  WITH (m = 32, ef_construction = 128);

-- Scalar indexes for filtering
CREATE INDEX IF NOT EXISTS idx_embeddings_content_type ON content_embeddings (content_type);
CREATE INDEX IF NOT EXISTS idx_embeddings_chunk_type ON content_embeddings (chunk_type);
CREATE INDEX IF NOT EXISTS idx_embeddings_project ON content_embeddings (content_project_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_itinerary ON content_embeddings (itinerary_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_destination ON content_embeddings (destination_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_property ON content_embeddings (property_id);

-- GIN indexes for array containment queries (@> operator)
CREATE INDEX IF NOT EXISTS idx_embeddings_destinations ON content_embeddings USING GIN (destinations);
CREATE INDEX IF NOT EXISTS idx_embeddings_properties ON content_embeddings USING GIN (properties);
CREATE INDEX IF NOT EXISTS idx_embeddings_species ON content_embeddings USING GIN (species);
