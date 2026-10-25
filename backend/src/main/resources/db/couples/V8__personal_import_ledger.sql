-- Provenance is written only by the migration role, never by normal requests.
create table personal_import_runs (
    source_schema varchar(63) primary key,
    imported_at timestamptz not null default current_timestamp,
    couple_id uuid not null,
    row_counts jsonb not null
);
create table imported_media_assets (
    id uuid primary key references media_assets(id) on delete cascade,
    object_key varchar(250) not null unique
);
create table imported_wish_photos (
    id uuid primary key references wish_photos(id) on delete cascade,
    object_key varchar(200) not null unique
);
