-- Add full post text column for semantic focus analysis (TICKET-033).
-- text_preview (280 chars) remains for display; text_full stores the complete text
-- from the Threads API for TF-IDF topic classification.
ALTER TABLE posts ADD COLUMN text_full text;
