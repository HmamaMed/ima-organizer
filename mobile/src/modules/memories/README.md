# Temporary memories

The OWNER creates a category and uploads photos/voice notes to it. Categories last 72 hours from creation. The expiry is shown on the cards and timeline, explained before creation, and enforced by both the UI and API. Existing chronological photo layouts/reveals and audio controls remain.

Uploads go through the authenticated backend to a private Cloudflare R2 bucket. The frontend saves returned asset IDs; read responses contain temporary signed media URLs. No Supabase client or storage key is used in the mobile app. The OWNER can delete a category early with explicit confirmation. The recipient can read active categories.

All pre-rollout memories are queued for erasure, including their old Supabase files. They are not migrated to R2. Deploy the backend/mobile update together and supply server storage credentials before expecting new uploads or physical old-file cleanup to complete.

[Setup and erasure guide](../../../../backend/R2-SETUP.md) · [Validation and screenshots](../../../../design-validation/temporary-memories/README.md).
