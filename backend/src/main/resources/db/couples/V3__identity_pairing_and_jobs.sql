alter table users add column email varchar(320);
alter table users add column email_verified boolean not null default false;
alter table users add column deletion_requested boolean not null default false;
alter table users add column locale varchar(20) default 'fr';
alter table users add column time_zone varchar(100) default 'UTC';
alter table users drop constraint users_role_check;
alter table users add constraint users_role_check check (role in ('OWNER', 'RECIPIENT', 'MEMBER'));
create unique index users_normalized_email on users (email) where email is not null;
alter table users add constraint users_email_normalized check (email is null or email = lower(trim(email)));

create table refresh_sessions (
    id uuid primary key, user_id uuid not null references users(id),
    token_hash varchar(64) not null unique, device_name varchar(100) not null,
    authenticated_at timestamptz not null, expires_at timestamptz not null, revoked_at timestamptz,
    created_at timestamptz not null default current_timestamp
);
create index refresh_sessions_user on refresh_sessions (user_id);
create table refresh_token_history (
    token_hash varchar(64) primary key, session_id uuid not null references refresh_sessions(id) on delete cascade
);
create table identity_actions (
    id uuid primary key, user_id uuid not null references users(id), kind varchar(20) not null check (kind in ('VERIFY', 'RESET')),
    token_hash varchar(64) not null unique, expires_at timestamptz not null, consumed_at timestamptz,
    created_at timestamptz not null default current_timestamp
);
create index identity_actions_user on identity_actions (user_id, kind);
create table couple_invitations (
    id uuid primary key, couple_id uuid not null references couples(id), inviter_id uuid not null references users(id),
    token_hash varchar(64) not null unique, intended_email varchar(320), expires_at timestamptz not null,
    consumed_at timestamptz, revoked_at timestamptz, created_at timestamptz not null default current_timestamp,
    foreign key (couple_id, inviter_id) references couple_memberships(couple_id, user_id)
);
create index invitations_couple on couple_invitations (couple_id);
create table outbox_jobs (
    id uuid primary key, kind varchar(30) not null, resource_id uuid not null, couple_id uuid,
    deduplication_key varchar(180) not null unique,
    state varchar(20) not null default 'READY' check (state in ('READY', 'RUNNING', 'DONE', 'CANCELLED', 'FAILED')),
    attempts integer not null default 0, next_attempt_at timestamptz not null default current_timestamp,
    lease_until timestamptz, lease_token uuid, last_error varchar(80), created_at timestamptz not null default current_timestamp
);
create index outbox_jobs_due on outbox_jobs (next_attempt_at, id) where state in ('READY', 'RUNNING');
create table abuse_limits (
    key_hash varchar(64) not null, bucket bigint not null, hits integer not null,
    primary key (key_hash, bucket)
);
create table device_registrations (
    id uuid primary key, user_id uuid not null references users(id), session_id uuid not null references refresh_sessions(id),
    fcm_token varchar(4096) not null, platform varchar(20) not null,
    last_seen_at timestamptz not null default current_timestamp, revoked_at timestamptz
);
create unique index device_active_token on device_registrations (fcm_token) where revoked_at is null;
create index device_user_sessions on device_registrations (user_id, session_id) where revoked_at is null;
