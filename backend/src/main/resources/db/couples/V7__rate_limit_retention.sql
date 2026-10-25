alter table abuse_limits add column created_at timestamptz not null default current_timestamp;
create index abuse_limits_expiry on abuse_limits(created_at);
