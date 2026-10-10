-- Allow xAI as a bring-your-own-key provider alongside Anthropic and
-- OpenAI-compatible endpoints.

ALTER TABLE users DROP CONSTRAINT users_llm_provider_check;

ALTER TABLE users ADD CONSTRAINT users_llm_provider_check
  CHECK (llm_provider IN ('anthropic', 'openai', 'xai'));
