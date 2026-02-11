-- Content embeddings table for RAG, consistency checking, and deduplication
-- Managed directly (not by Payload). Foreign key constraints intentionally omitted —
-- IDs are application-managed references to Payload collections.

CREATE TABLE IF NOT EXISTS content_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_type TEXT NOT NULL CHECK (chunk_type IN (
    'research_extract',
    'article_section',
    'faq_answer',
    'designer_insight',
    'itinerary_context',
    'editorial_directive',
    'conversation_insight',
    'destination_section',
    'itinerary_segment',
    'page_section',
    'property_section'
  )),
  chunk_text TEXT NOT NULL,
  embedding vector(3072) NOT NULL,

  content_project_id INTEGER,
  itinerary_id INTEGER,
  destination_id INTEGER,
  property_id INTEGER,

  content_type TEXT,
  destinations TEXT[],
  properties TEXT[],
  species TEXT[],
  freshness_category TEXT,
  audience_relevance TEXT[],

  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
