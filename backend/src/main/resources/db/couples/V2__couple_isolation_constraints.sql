-- Slot numbers are capacity controls, never partner roles.
alter table couples add constraint couples_closure_consistent
    check ((status = 'CLOSED') = (closed_at is not null));
alter table couple_memberships add constraint membership_slot_valid check (slot in (1, 2));
alter table couple_memberships add constraint membership_dates_valid check (left_at is null or left_at >= joined_at);
create unique index membership_one_active_couple_per_user on couple_memberships (user_id) where left_at is null;
create unique index membership_one_active_user_per_couple on couple_memberships (couple_id, user_id) where left_at is null;
create unique index membership_one_active_member_per_slot on couple_memberships (couple_id, slot) where left_at is null;
-- Closed spaces never reopen; a later pairing gets a new couple ID. Preserve one membership history per pair.
alter table couple_memberships add constraint membership_couple_user_unique unique (couple_id, user_id);

alter table watch_items alter column couple_id set not null;
alter table watch_items alter column created_by_id set not null;
alter table watch_items add constraint watch_item_couple_fk foreign key (couple_id) references couples (id);
alter table watch_items add constraint watch_item_creator_membership_fk
    foreign key (couple_id, created_by_id) references couple_memberships (couple_id, user_id);
alter table watch_items add constraint watch_item_id_couple_unique unique (id, couple_id);
create index watch_items_couple_feed on watch_items (couple_id, created_at desc, id desc);

alter table watch_reviews alter column couple_id set not null;
alter table watch_reviews add constraint watch_review_item_scope_fk
    foreign key (item_id, couple_id) references watch_items (id, couple_id);
alter table watch_reviews add constraint watch_review_member_scope_fk
    foreign key (couple_id, user_id) references couple_memberships (couple_id, user_id);
alter table watch_reviews add constraint watch_review_rating_valid check (rating between 1 and 5);
create index watch_reviews_couple_item on watch_reviews (couple_id, item_id, updated_at);
