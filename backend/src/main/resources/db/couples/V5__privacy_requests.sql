create table deletion_requests (
    id uuid primary key, user_id uuid not null, state varchar(20) not null default 'QUEUED' check(state in ('QUEUED','COMPLETE')),
    requested_at timestamptz not null default current_timestamp, completed_at timestamptz
);
create unique index deletion_request_per_user on deletion_requests(user_id);
create table support_reports (
    id uuid primary key, reporter_id uuid, couple_id uuid, kind varchar(30) not null check(kind in ('PROBLEM','UNWANTED_PARTNER')),
    message varchar(2000) not null, created_at timestamptz not null default current_timestamp
);
-- Minimal UUID markers survive user deletion; backup restore procedures must reapply these before enabling access.
create table deletion_markers (user_id uuid primary key, requested_at timestamptz not null default current_timestamp);
