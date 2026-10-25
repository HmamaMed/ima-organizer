-- Fresh commercial database only. Existing personal databases must not be baselined with this snapshot.

-- Includes dormant module tables because Hibernate still validates the monolith; their APIs/jobs are disabled.

create table agios (
    amount numeric(14,2) not null,
    credit_date date not null,
    created_at timestamp(6) with time zone not null,
    id uuid not null,
    user_id uuid not null,
    primary key (id)
);

create table birthday_deliveries (
    birthday_date date not null,
    days_before integer not null,
    sent_at timestamp(6) with time zone not null,
    id uuid not null,
    reminder_id uuid not null,
    primary key (id),
    constraint birthday_delivery_unique unique (reminder_id, birthday_date, days_before)
);

create table birthday_notifications (
    birthday_date date not null,
    days_before integer not null,
    dismissed boolean not null,
    created_at timestamp(6) with time zone not null,
    id uuid not null,
    reminder_id uuid not null,
    user_id uuid not null,
    title varchar(80) not null,
    body varchar(200) not null,
    primary key (id),
    constraint birthday_notification_unique unique (reminder_id, birthday_date, days_before)
);

create table birthday_reminders (
    birthday_day integer not null,
    birthday_month integer not null,
    created_at timestamp(6) with time zone not null,
    id uuid not null,
    user_id uuid not null,
    label varchar(100) not null,
    time_zone varchar(100) not null,
    primary key (id)
);

create table couple_memberships (
    slot integer not null,
    joined_at timestamp(6) with time zone not null,
    left_at timestamp(6) with time zone,
    couple_id uuid not null,
    id uuid not null,
    user_id uuid not null,
    primary key (id)
);

create table couples (
    closed_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone not null,
    id uuid not null,
    status varchar(20) not null check ((status in ('WAITING','ACTIVE','CLOSED'))),
    primary key (id)
);

create table day_exercises (
    rest_seconds integer,
    sets integer not null,
    sort_order integer not null,
    id uuid not null,
    library_exercise_id uuid not null,
    programme_day_id uuid not null,
    note varchar(500),
    reps varchar(255) not null,
    primary key (id)
);

create table exercise_ticks (
    tick_date date not null,
    completed_at timestamp(6) with time zone not null,
    day_exercise_id uuid not null,
    id uuid not null,
    user_id uuid not null,
    primary key (id)
);

create table library_exercises (
    created_at timestamp(6) with time zone not null,
    id uuid not null,
    image_url varchar(1000),
    video_url varchar(1000),
    instructions varchar(2000) not null,
    muscle_group varchar(255) not null check ((muscle_group in ('LEGS','GLUTES','CORE','UPPER_BODY','CARDIO','FULL_BODY','MOBILITY'))),
    name varchar(255) not null,
    primary key (id)
);

create table media_assets (
    attached boolean not null,
    created_at timestamp(6) with time zone not null,
    size bigint not null,
    group_id uuid not null,
    id uuid not null,
    content_type varchar(100) not null,
    object_key varchar(250) not null unique,
    primary key (id)
);

create table memories (
    memory_date date not null,
    created_at timestamp(6) with time zone not null,
    audio_asset_id uuid,
    group_id uuid,
    id uuid not null,
    photo_asset_id uuid,
    caption varchar(4000),
    audio_url varchar(255),
    photo_url varchar(255) not null,
    primary key (id)
);

create table memory_groups (
    created_at timestamp(6) with time zone not null,
    deleted_at timestamp(6) with time zone,
    expires_at timestamp(6) with time zone,
    id uuid not null,
    name varchar(100) not null,
    description varchar(500),
    primary key (id)
);

create table notes (
    created_at timestamp(6) with time zone not null,
    notification_sent_at timestamp(6) with time zone,
    scheduled_for timestamp(6) with time zone,
    sent_at timestamp(6) with time zone,
    id uuid not null,
    content varchar(4000) not null,
    audio_url varchar(255),
    notification_status varchar(255) not null check ((notification_status in ('PENDING','SENT','FAILED'))),
    status varchar(255) not null check ((status in ('DRAFT','SCHEDULED','SENT','CANCELLED'))),
    primary key (id)
);

create table programme_days (
    sort_order integer not null,
    id uuid not null,
    programme_id uuid not null,
    coach_note varchar(500),
    label varchar(255) not null,
    primary key (id)
);

create table programmes (
    active boolean not null,
    created_at timestamp(6) with time zone not null,
    id uuid not null,
    description varchar(500),
    name varchar(255) not null,
    primary key (id)
);

create table recipe_ingredients (
    ingredient_position integer not null check ((ingredient_position>=0)),
    recipe_id uuid not null,
    amount varchar(80),
    ingredient_name varchar(120) not null,
    primary key (ingredient_position, recipe_id)
);

create table recipe_steps (
    step_position integer not null check ((step_position>=0)),
    recipe_id uuid not null,
    instruction varchar(2000) not null,
    primary key (step_position, recipe_id)
);

create table recipes (
    minutes integer,
    servings integer not null,
    created_at timestamp(6) with time zone not null,
    id uuid not null,
    status varchar(20) not null check ((status in ('TO_TRY','FAVORITE'))),
    title varchar(150) not null,
    tips varchar(2000),
    primary key (id)
);

create table users (
    id uuid not null,
    fcm_token varchar(255),
    name varchar(255) not null,
    password_hash varchar(255) not null,
    role varchar(255) not null check ((role in ('OWNER','RECIPIENT'))),
    primary key (id)
);

create table watch_items (
    created_at timestamp(6) with time zone not null,
    couple_id uuid,
    created_by_id uuid,
    id uuid not null,
    kind varchar(20) not null check ((kind in ('FILM','SERIES'))),
    status varchar(20) not null check ((status in ('TO_WATCH','IN_PROGRESS','WATCHED'))),
    title varchar(150) not null,
    notes varchar(2000),
    primary key (id)
);

create table watch_reviews (
    rating integer not null,
    updated_at timestamp(6) with time zone not null,
    couple_id uuid,
    id uuid not null,
    item_id uuid not null,
    user_id uuid not null,
    comment varchar(2000),
    primary key (id),
    constraint watch_review_per_user unique (item_id, user_id)
);

create table wish_photos (
    ready boolean not null,
    delete_after timestamp(6) with time zone,
    id uuid not null,
    uploader_id uuid not null,
    object_key varchar(200) not null unique,
    primary key (id)
);

create table wishes (
    created_at timestamp(6) with time zone not null,
    id uuid not null,
    photo_id uuid unique,
    category varchar(20) not null check ((category in ('OBJECT','BOOK','EXPERIENCE'))),
    title varchar(150) not null,
    details varchar(2000),
    link varchar(2000),
    primary key (id)
);

create table workout_logs (
    completed_at timestamp(6) with time zone not null,
    id uuid not null,
    user_id uuid,
    workout_day_id uuid not null,
    primary key (id)
);

create index agios_user_date_idx on agios (user_id, credit_date);

create index birthday_notification_inbox on birthday_notifications (user_id, dismissed, created_at);

create index birthdays_user_idx on birthday_reminders (user_id);

create index media_assets_group_idx on media_assets (group_id);

create index wish_photos_cleanup on wish_photos (delete_after);

alter table if exists agios add constraint FK4ogols3cfpn34w6csadb91c5x foreign key (user_id) references users;

alter table if exists birthday_deliveries add constraint FKrn6cwniycocqminvjrr3v8l06 foreign key (reminder_id) references birthday_reminders;

alter table if exists birthday_notifications add constraint FKjpsyte08idix9rvmorf7938s5 foreign key (user_id) references users;

alter table if exists birthday_reminders add constraint FK768xhqmdblaqdirubyff5jr24 foreign key (user_id) references users;

alter table if exists couple_memberships add constraint FKlwlbgrnuhxa4eh11d7mvnswtc foreign key (couple_id) references couples;

alter table if exists couple_memberships add constraint FKoo1suf1o0w5ti6pw21m9mb59v foreign key (user_id) references users;

alter table if exists day_exercises add constraint FKi44959amgfypod1eusue0o6la foreign key (library_exercise_id) references library_exercises;

alter table if exists day_exercises add constraint FKe8d582g5aoue9vgfhto0jhpgi foreign key (programme_day_id) references programme_days;

alter table if exists media_assets add constraint FKac9to9pb2vmtfl8xrrmolk962 foreign key (group_id) references memory_groups;

alter table if exists memories add constraint FKeb465u3cc91q24wxcx4noa9b8 foreign key (audio_asset_id) references media_assets;

alter table if exists memories add constraint FKhupyo3en4hjkar7w39qmv6p6a foreign key (group_id) references memory_groups;

alter table if exists memories add constraint FKn3fsiadji6upyie6m913ac745 foreign key (photo_asset_id) references media_assets;

alter table if exists programme_days add constraint FKl9wviik6yb34htmbx9j2cw313 foreign key (programme_id) references programmes;

alter table if exists recipe_ingredients add constraint FKcqlw8sor5ut10xsuj3jnttkc foreign key (recipe_id) references recipes;

alter table if exists recipe_steps add constraint FKof4i3g3aiwgro5ykaf1j28iw1 foreign key (recipe_id) references recipes;

alter table if exists watch_items add constraint FKqb4fuqypmeckcsd71vtog1lvg foreign key (created_by_id) references users;

alter table if exists watch_reviews add constraint FKlm8d9r9v5miloqwmw83n9b8ge foreign key (item_id) references watch_items;

alter table if exists watch_reviews add constraint FKlof2qtdv9j8f5nppdxb5w7cen foreign key (user_id) references users;

alter table if exists wish_photos add constraint FK9sfofbjmh6cu85460mov8vajj foreign key (uploader_id) references users;

alter table if exists wishes add constraint FKqnxl0w42laj1yyvskv8g32kq1 foreign key (photo_id) references wish_photos;
