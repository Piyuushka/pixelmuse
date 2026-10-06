-- Create extension if not exists for PostGIS
create extension if not exists postgis;

-- Create the barriers table
create table if not exists public.barriers (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  category text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  location_name text,
  geom geometry(Point, 4326) not null,
  road_layer text default 'at_grade',
  status text default 'Reported',
  votes integer default 1,
  downvotes integer default 0,
  expires_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- Index for spatial queries
create index if not exists barriers_geom_idx on public.barriers using gist (geom);

-- RPC function to find barriers near a route (polyline)
-- Expects an array of coordinates or just we can use ST_DWithin directly in queries.
create or replace function get_barriers_near_path(
  path_line geometry(LineString, 4326),
  buffer_meters float default 20.0
)
returns table (
  id uuid,
  title text,
  category text,
  severity text,
  geom geometry(Point, 4326),
  distance float
)
language sql stable
as $$
  select
    b.id,
    b.title,
    b.category,
    b.severity,
    b.geom,
    ST_Distance(b.geom::geography, path_line::geography) as distance
  from
    public.barriers b
  where
    ST_DWithin(b.geom::geography, path_line::geography, buffer_meters)
    and (b.expires_at is null or b.expires_at > now())
    and b.status != 'Expired'
    and b.status != 'Resolved'
  order by
    distance asc;
$$;
