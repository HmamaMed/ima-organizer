-- Sent messages are retained for seven days; drafts and scheduled notes are preserved.
create index notes_conversation_cursor on notes(couple_id,sent_at desc,id desc) where status='SENT';
create index notes_retention_due on notes(sent_at,id) where status='SENT';

alter table wishes add column completed_at timestamptz;
create index wishes_owner_feed on wishes(couple_id,owner_id,created_at desc,id desc);
