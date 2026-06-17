CREATE OR REPLACE FUNCTION get_current_amenities(space_id UUID)
RETURNS json
LANGUAGE sql
AS $$
  WITH recent_votes AS (
    SELECT amenity, working
    FROM amenity_votes
    WHERE amenity_votes.space_id = get_current_amenities.space_id
      AND created_at >= NOW() - INTERVAL '2 hours'
  ),
  stats AS (
    SELECT 
      amenity,
      (COUNT(CASE WHEN working THEN 1 END)::float / COUNT(*)) >= 0.6 AS is_working
    FROM recent_votes
    GROUP BY amenity
  )
  SELECT json_build_object(
    'wifi', (SELECT is_working FROM stats WHERE amenity = 'wifi'),
    'power', (SELECT is_working FROM stats WHERE amenity = 'power'),
    'quiet', (SELECT is_working FROM stats WHERE amenity = 'quiet')
  );
$$;
