-- Read-only verification after 131_01_route_catalog.sql
SELECT 'regions' AS object, count(*) AS rows FROM public.delivery_regions
UNION ALL SELECT 'zones', count(*) FROM public.delivery_temperature_zones
UNION ALL SELECT 'region_zone_rates',count(*) FROM public.delivery_region_zone_rates
UNION ALL SELECT 'routes', count(*) FROM public.routes;
-- No existing route has to be assigned a region; legacy assignments are preserved.
SELECT route_code,route_name,temperature_zone,delivery_region_id,default_start_time,default_end_time
FROM public.routes ORDER BY route_code LIMIT 30;
