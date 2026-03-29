-- Add BYOK LLM provider settings to users table
ALTER TABLE users
  ADD COLUMN llm_provider text CHECK (llm_provider IN ('anthropic', 'openai')),
  ADD COLUMN llm_api_key_encrypted text;
