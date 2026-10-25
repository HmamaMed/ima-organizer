alter table notes add column couple_id uuid not null references couples(id);
alter table notes add column sender_id uuid not null;
alter table notes add column recipient_id uuid;
alter table notes add column client_request_id uuid not null;
alter table notes add column delivery_version integer not null default 1;
alter table notes add constraint note_sender_membership foreign key(couple_id,sender_id) references couple_memberships(couple_id,user_id);
alter table notes add constraint note_recipient_membership foreign key(couple_id,recipient_id) references couple_memberships(couple_id,user_id);
alter table notes add constraint note_other_partner check (sender_id <> recipient_id);
alter table notes add constraint note_recipient_required check (status not in ('SENT','SCHEDULED') or recipient_id is not null);
alter table notes add constraint note_schedule_required check (status <> 'SCHEDULED' or scheduled_for is not null);
alter table notes add constraint note_sent_at_required check ((status = 'SENT') = (sent_at is not null));
alter table notes add constraint note_create_idempotent unique(couple_id,sender_id,client_request_id);
create index notes_couple_sender on notes(couple_id,sender_id,created_at desc,id desc);
create index notes_couple_recipient on notes(couple_id,recipient_id,sent_at desc,id desc) where status='SENT';

alter table memory_groups add column couple_id uuid not null references couples(id);
alter table memory_groups add column creator_id uuid not null;
alter table memory_groups add column client_request_id uuid not null;
alter table memory_groups alter column expires_at set not null;
alter table memory_groups add constraint group_creator_membership foreign key(couple_id,creator_id) references couple_memberships(couple_id,user_id);
alter table memory_groups add constraint group_scope_creator unique(id,couple_id,creator_id);
alter table memory_groups add constraint group_request_unique unique(couple_id,creator_id,client_request_id);
create index memory_groups_couple on memory_groups(couple_id,created_at desc,id desc) where deleted_at is null;

alter table media_assets add column couple_id uuid not null;
alter table media_assets add column owner_id uuid not null;
alter table media_assets add column upload_state varchar(20) not null default 'READY' check(upload_state in ('UPLOADING','READY','DELETING'));
alter table media_assets add constraint asset_group_scope foreign key(group_id,couple_id,owner_id) references memory_groups(id,couple_id,creator_id);
alter table media_assets add constraint asset_scope_unique unique(id,group_id,couple_id,owner_id);
create index media_assets_couple_quota on media_assets(couple_id,owner_id);

alter table memories add column couple_id uuid not null;
alter table memories add column creator_id uuid not null;
alter table memories add column client_request_id uuid not null;
alter table memories add column deleted_at timestamptz;
alter table memories alter column group_id set not null;
alter table memories alter column photo_asset_id set not null;
alter table memories add constraint memory_group_scope foreign key(group_id,couple_id,creator_id) references memory_groups(id,couple_id,creator_id);
alter table memories add constraint memory_photo_scope foreign key(photo_asset_id,group_id,couple_id,creator_id) references media_assets(id,group_id,couple_id,owner_id);
alter table memories add constraint memory_audio_scope foreign key(audio_asset_id,group_id,couple_id,creator_id) references media_assets(id,group_id,couple_id,owner_id);
alter table memories add constraint memory_request_unique unique(couple_id,creator_id,client_request_id);
alter table memories add constraint memory_photo_single_use unique(photo_asset_id);
alter table memories add constraint memory_audio_single_use unique(audio_asset_id);
create index memories_couple_feed on memories(couple_id,created_at desc,id desc) where deleted_at is null;

create table partner_notifications (
    id uuid primary key, couple_id uuid not null references couples(id), recipient_id uuid not null, author_id uuid not null,
    kind varchar(20) not null check(kind in ('NOTE','MEMORY')), resource_id uuid not null,
    created_at timestamptz not null default current_timestamp, dismissed boolean not null default false,
    unique(recipient_id,kind,resource_id),
    foreign key(couple_id,recipient_id) references couple_memberships(couple_id,user_id),
    foreign key(couple_id,author_id) references couple_memberships(couple_id,user_id),
    check(recipient_id <> author_id)
);
create index partner_notifications_inbox on partner_notifications(recipient_id,couple_id,created_at desc,id desc);
create table notification_preferences (
    user_id uuid primary key references users(id), notes_enabled boolean not null default true,
    memories_enabled boolean not null default true, previews_enabled boolean not null default false
);
