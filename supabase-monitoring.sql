-- Usage monitoring for the draft app.
-- NOTE: draft_rooms self-purges every hour (rooms older than 24h are deleted by
-- the `cleanup-old-rooms` pg_cron job below), so any "per day / all-time" query
-- against draft_rooms is meaningless — it only ever holds the last 24h.
-- Long-term history lives in `room_stats`, tallied by the cron BEFORE the delete.

-- ─────────────────────────────────────────────────────────────────────────────
-- LIVE SNAPSHOT (accurate — only asks about the active <24h window)
-- ─────────────────────────────────────────────────────────────────────────────

-- Everything alive right now
select
  count(*)                                                        as active_rooms,
  count(*) filter (where created_at > now() - interval '1 hour')  as last_hour,
  sum(jsonb_array_length(state->'players'))                       as players_in_flight
from draft_rooms;

-- How far rooms get (lobby vs drafting vs finished) — real engagement signal
select state->>'phase' as phase, count(*)
from draft_rooms
group by phase
order by count desc;

-- Recent rooms with detail
select
  id,
  created_at,
  jsonb_array_length(state->'players')  as players,
  state->'config'->>'mode'              as mode,
  state->>'phase'                       as phase,
  pg_column_size(state)                 as state_bytes
from draft_rooms
order by created_at desc
limit 50;

-- Table storage footprint
select
  pg_size_pretty(pg_total_relation_size('draft_rooms'))  as table_size,
  count(*)                                                as rows,
  pg_size_pretty(avg(pg_column_size(state))::bigint)      as avg_state
from draft_rooms;

-- ─────────────────────────────────────────────────────────────────────────────
-- LONG-TERM HISTORY (survives the hourly purge)
-- ─────────────────────────────────────────────────────────────────────────────

-- Rooms created per day (the Discord-traffic view)
select * from room_stats order by day desc;

-- ─────────────────────────────────────────────────────────────────────────────
-- SETUP (already applied in the live project — kept here for reference / redeploy)
-- ─────────────────────────────────────────────────────────────────────────────

-- create table if not exists room_stats (
--   day date primary key,
--   rooms_created int default 0
-- );
--
-- Hourly cleanup that TALLIES into room_stats before deleting:
-- select cron.schedule(
--   'cleanup-old-rooms',
--   '0 * * * *',
--   $$
--     insert into room_stats (day, rooms_created)
--     select date(created_at), count(*)
--       from draft_rooms
--      where created_at < now() - interval '24 hours'
--     group by date(created_at)
--     on conflict (day) do update
--       set rooms_created = room_stats.rooms_created + excluded.rooms_created;
--
--     delete from draft_rooms where created_at < now() - interval '24 hours';
--   $$
-- );
