-- Add base URL and custom model for OpenAI-compatible providers
ALTER TABLE users
  ADD COLUMN llm_base_url text,
  ADD COLUMN llm_model text;
