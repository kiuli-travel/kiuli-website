-- Enable pgvector extension
-- Neon supports pgvector natively; this is idempotent
CREATE EXTENSION IF NOT EXISTS vector;
