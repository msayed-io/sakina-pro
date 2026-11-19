# Sakeenah AI — investigation and test boundaries

## Missing responses: status unresolved

The screen creates or opens a conversation, calls the `sakeenah-ai` Edge Function, displays SSE text as it arrives, and loads persisted rows from `ai_messages` when a conversation is opened. The checked-in Edge Function saves the user message before generation, streams text, then inserts the assistant message and finally emits `[DONE]`. The original client caught a server-sent `{error: ...}` inside the JSON parse catch, continued, and treated the result as successful; the reply could remain visible during streaming even when saving it failed. A browser test with a mocked failure confirms this silent-error path. Separately, the checked-in schema limits message content to 8,000 characters; this is one possible failure condition, not proof of the production cause.

The actual deployed function, database rows, RLS, logs, network behavior and affected user session were not inspected; the Supabase connection was disabled. Therefore this does **not** prove why this user's previous replies are missing, whether they were stored, or whether they can be recovered. Recent performance commits did not modify the AI storage service or Edge Function. Do not delete or rewrite affected conversations while investigating. Compare deployment version and privacy-preserving counts/metadata of user/assistant rows for a specific affected conversation, and correlate the function's `sakeenah_ai_stream_error` request ID and timestamp; avoid collecting message content, authentication tokens or credentials unnecessarily.

The client now treats server errors, an incomplete stream and an empty reply as failures, leaves any streamed response on screen for copying and warns that persistence could not be confirmed. This fixes false success reporting only; it neither repairs an unknown server failure nor recovers already absent data. `[DONE]` is sent by the checked-in server after the save completes for nonempty responses; behavior of an unverified deployment may differ.

## Other scoped changes

- Local SVG approximates the attached drawer icon; a raster reference alone does not establish exact source or pixel identity.
- Drawer and its action menu use opaque theme surfaces, without the previous glass and bright outline. Normal menu actions remain.
- Dark AI input/textarea focus outlines and cut-crystal input focus rings are suppressed, without changing other screens or button focus. Keyboard focus visibility on those text fields is reduced as requested. Text insertion caret remains functional.
- Existing action row is shown for the latest reply or for a previous reply selected by click/touch or Enter/Space. Copy and feedback controls themselves are unchanged.
- Shared page title card and user bubble now use dark theme surfaces; the URL text is removed while copy-link remains available. No sharing API behavior changed.

## Reproducible browser regression

Start Vite with `VITE_SUPABASE_URL=https://mock.invalid VITE_SUPABASE_PUBLISHABLE_KEY=public-test-key DISABLE_HMR=true` on port 4189 and run `node scripts/test-sakeenah-ai.cjs`. The test intercepts `mock.invalid` and uses synthetic conversation rows, synthetic session and SSE; it does not access a real user account. It tests both themes, displayed loaded replies, previous-reply copying, drawer opacity, input focus, mocked SSE failure and success, public dark surfaces, hidden URL and copy link. It is not an Android WebView or a production storage test.
