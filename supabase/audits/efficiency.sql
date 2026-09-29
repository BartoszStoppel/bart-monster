-- Legacy Supabase audit; diagnostic only, never a migration.
-- Requires the 14 public tables measured in docs/supabase-audit.md.
-- Returns aggregate data and schema metadata, never complete user records.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';

-- Check: observation and allocated table sizes (row estimates here; exact counts below).
SELECT now() AS audited_at, current_setting('server_version') AS postgres,
       current_setting('transaction_read_only') AS read_only,
       (SELECT stats_reset FROM pg_stat_database WHERE datname=current_database()) AS stats_reset,
       (SELECT jsonb_agg(t ORDER BY t.total_bytes DESC) FROM (
         SELECT s.relname, pg_table_size(s.relid) AS table_bytes,
                pg_indexes_size(s.relid) AS index_bytes, pg_total_relation_size(s.relid) AS total_bytes,
                s.n_live_tup, s.n_dead_tup, s.n_tup_ins, s.n_tup_upd, s.n_tup_del
         FROM pg_stat_user_tables s WHERE s.schemaname='public'
       ) t) AS tables;

-- Check: exact counts, duplicate keys, empty associations, history observations.
WITH counts AS (
 SELECT 'profiles' AS table_name, count(*) AS rows FROM public.profiles
 UNION ALL SELECT 'board_games', count(*) FROM public.board_games
 UNION ALL SELECT 'user_game_collection', count(*) FROM public.user_game_collection
 UNION ALL SELECT 'game_ratings', count(*) FROM public.game_ratings
 UNION ALL SELECT 'tier_placements', count(*) FROM public.tier_placements
 UNION ALL SELECT 'game_expansions', count(*) FROM public.game_expansions
 UNION ALL SELECT 'expansion_tier_placements', count(*) FROM public.expansion_tier_placements
 UNION ALL SELECT 'achievements', count(*) FROM public.achievements
 UNION ALL SELECT 'user_achievements', count(*) FROM public.user_achievements
 UNION ALL SELECT 'bounties', count(*) FROM public.bounties
 UNION ALL SELECT 'feedback', count(*) FROM public.feedback
 UNION ALL SELECT 'score_snapshots', count(*) FROM public.score_snapshots
 UNION ALL SELECT 'user_activity', count(*) FROM public.user_activity
 UNION ALL SELECT 'user_alignments', count(*) FROM public.user_alignments
), duplicate_keys AS (
 SELECT 'collection_user_game' AS key_name, count(*) AS groups FROM (
  SELECT user_id,bgg_id FROM public.user_game_collection GROUP BY 1,2 HAVING count(*)>1) d
 UNION ALL SELECT 'rating_user_game',count(*) FROM (
  SELECT user_id,bgg_id FROM public.game_ratings GROUP BY 1,2 HAVING count(*)>1) d
 UNION ALL SELECT 'placement_user_game',count(*) FROM (
  SELECT user_id,bgg_id FROM public.tier_placements GROUP BY 1,2 HAVING count(*)>1) d
 UNION ALL SELECT 'expansion_user_item',count(*) FROM (
  SELECT user_id,expansion_id FROM public.expansion_tier_placements GROUP BY 1,2 HAVING count(*)>1) d
 UNION ALL SELECT 'alignment_user_category',count(*) FROM (
  SELECT user_id,category FROM public.user_alignments GROUP BY 1,2 HAVING count(*)>1) d
 UNION ALL SELECT 'award_user_achievement',count(*) FROM (
  SELECT user_id,achievement_id FROM public.user_achievements GROUP BY 1,2 HAVING count(*)>1) d
 UNION ALL SELECT 'expansion_parent_bgg_id',count(*) FROM (
  SELECT game_bgg_id,bgg_expansion_id FROM public.game_expansions WHERE bgg_expansion_id IS NOT NULL GROUP BY 1,2 HAVING count(*)>1) d
 UNION ALL SELECT 'expansion_parent_normalized_name',count(*) FROM (
  SELECT game_bgg_id,lower(trim(name)) FROM public.game_expansions GROUP BY 1,2 HAVING count(*)>1) d
 UNION ALL SELECT 'game_normalized_name',count(*) FROM (
  SELECT lower(trim(name)) FROM public.board_games GROUP BY 1 HAVING count(*)>1) d
), history AS (
 SELECT *, row_number() OVER w AS sequence, lag(score) OVER w AS previous
 FROM public.score_snapshots WINDOW w AS (PARTITION BY user_id,bgg_id ORDER BY snapshot_at,id)
), metrics AS (
 SELECT 'collection_null_key' AS metric,count(*) AS value FROM public.user_game_collection WHERE user_id IS NULL OR bgg_id IS NULL
 UNION ALL SELECT 'rating_null_key',count(*) FROM public.game_ratings WHERE user_id IS NULL OR bgg_id IS NULL
 UNION ALL SELECT 'placement_null_key',count(*) FROM public.tier_placements WHERE user_id IS NULL OR bgg_id IS NULL
 UNION ALL SELECT 'award_null_key',count(*) FROM public.user_achievements WHERE user_id IS NULL OR achievement_id IS NULL
 UNION ALL SELECT 'collection_empty',count(*) FROM public.user_game_collection WHERE owned IS NOT TRUE AND wishlist IS NOT TRUE AND wishlist_priority IS NULL AND coalesce(trim(wishlist_note),'')=''
 UNION ALL SELECT 'collection_inactive_with_metadata',count(*) FROM public.user_game_collection WHERE owned IS NOT TRUE AND wishlist IS NOT TRUE AND (wishlist_priority IS NOT NULL OR coalesce(trim(wishlist_note),'')<>'')
 UNION ALL SELECT 'collection_owned_and_wishlist',count(*) FROM public.user_game_collection WHERE owned AND wishlist
 UNION ALL SELECT 'ratings_with_comments',count(*) FROM public.game_ratings WHERE coalesce(trim(comment),'')<>''
 UNION ALL SELECT 'ratings_without_collection',count(*) FROM public.game_ratings r WHERE NOT EXISTS (SELECT 1 FROM public.user_game_collection c WHERE c.user_id=r.user_id AND c.bgg_id=r.bgg_id)
 UNION ALL SELECT 'ratings_without_placement',count(*) FROM public.game_ratings r WHERE NOT EXISTS (SELECT 1 FROM public.tier_placements p WHERE p.user_id=r.user_id AND p.bgg_id=r.bgg_id)
 UNION ALL SELECT 'ratings_different_from_tier_score',count(*) FROM public.game_ratings r JOIN public.tier_placements p USING(user_id,bgg_id) WHERE r.rating IS DISTINCT FROM p.score
 UNION ALL SELECT 'placements_without_collection',count(*) FROM public.tier_placements p WHERE NOT EXISTS (SELECT 1 FROM public.user_game_collection c WHERE c.user_id=p.user_id AND c.bgg_id=p.bgg_id)
 UNION ALL SELECT 'expansion_wrong_parent',count(*) FROM public.expansion_tier_placements p JOIN public.game_expansions e ON e.id=p.expansion_id WHERE p.game_bgg_id<>e.game_bgg_id
 UNION ALL SELECT 'alignment_stale_profile_copy',count(*) FROM public.user_alignments a JOIN public.profiles p ON p.id=a.user_id WHERE a.display_name IS DISTINCT FROM p.display_name OR a.avatar_url IS DISTINCT FROM p.avatar_url
 UNION ALL SELECT 'alignment_without_current_ranking',count(*) FROM public.user_alignments a WHERE NOT EXISTS (SELECT 1 FROM public.tier_placements t JOIN public.board_games g USING(bgg_id) WHERE t.user_id=a.user_id AND g.category=a.category)
 UNION ALL SELECT 'ranking_user_category_without_alignment',count(*) FROM (SELECT DISTINCT t.user_id,g.category FROM public.tier_placements t JOIN public.board_games g USING(bgg_id)) r WHERE NOT EXISTS (SELECT 1 FROM public.user_alignments a WHERE a.user_id=r.user_id AND a.category=r.category)
 UNION ALL SELECT 'placement_duplicate_order_slots',count(*) FROM (SELECT t.user_id,g.category,t.tier,t.position FROM public.tier_placements t JOIN public.board_games g USING(bgg_id) GROUP BY 1,2,3,4 HAVING count(*)>1) d
 UNION ALL SELECT 'placement_null_score',count(*) FROM public.tier_placements WHERE score IS NULL
 UNION ALL SELECT 'placement_negative_position',count(*) FROM public.tier_placements WHERE position<0
 UNION ALL SELECT 'snapshot_missing_profile_rows',count(*) FROM public.score_snapshots s WHERE user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=s.user_id)
 UNION ALL SELECT 'snapshot_missing_profile_users',count(DISTINCT user_id) FROM public.score_snapshots s WHERE user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=s.user_id)
 UNION ALL SELECT 'achievement_bounty_shared_slug',count(*) FROM public.achievements a JOIN public.bounties b USING(slug)
 UNION ALL SELECT 'achievement_bounty_identical_definition',count(*) FROM public.achievements a JOIN public.bounties b ON (a.title,a.description,a.icon)=(b.title,b.description,b.icon)
 UNION ALL SELECT 'game_playing_time_equals_max',count(*) FROM public.board_games WHERE playing_time IS NOT NULL AND playing_time=max_play_time
 UNION ALL SELECT 'game_playing_time_distinct_max',count(*) FROM public.board_games WHERE playing_time IS DISTINCT FROM max_play_time
 UNION ALL SELECT 'profile_nonreciprocal_partner',count(*) FROM public.profiles p LEFT JOIN public.profiles partner ON partner.id=p.partner_id WHERE p.partner_id IS NOT NULL AND partner.partner_id IS DISTINCT FROM p.id
)
SELECT now() AS audited_at,current_setting('transaction_read_only') AS read_only,
 (SELECT jsonb_object_agg(table_name,rows) FROM counts) AS row_counts,
 (SELECT jsonb_object_agg(key_name,groups) FROM duplicate_keys) AS duplicate_key_groups,
 (SELECT jsonb_object_agg(metric,value) FROM metrics) AS metrics,
 (SELECT jsonb_build_object('rows',count(*),'personal',count(*) FILTER(WHERE user_id IS NOT NULL),
  'community',count(*) FILTER(WHERE user_id IS NULL),'earliest',min(snapshot_at),'latest',max(snapshot_at),
  'consecutive_equal_scores',count(*) FILTER(WHERE sequence>1 AND score IS NOT DISTINCT FROM previous),
  'decreases',count(*) FILTER(WHERE sequence>1 AND score<previous)) FROM history) AS history,
 (SELECT jsonb_build_object('groups',count(*),'extra_rows',coalesce(sum(n-1),0)) FROM (
  SELECT user_id,bgg_id,score,snapshot_at,count(*) n FROM public.score_snapshots GROUP BY 1,2,3,4 HAVING count(*)>1) d) AS exact_duplicate_history,
 (SELECT count(*) FROM (SELECT user_id,bgg_id,snapshot_at FROM public.score_snapshots GROUP BY 1,2,3 HAVING count(DISTINCT score)>1) d) AS ambiguous_history_timestamps;

-- Check: policies, migration ledger, consolidation overlap, position ties, index coverage.
SELECT
 (SELECT jsonb_agg(t) FROM (SELECT tablename,policyname,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename='score_snapshots') t) AS snapshot_policies,
 (SELECT jsonb_agg(t) FROM (SELECT version,name FROM supabase_migrations.schema_migrations ORDER BY version) t) AS migrations,
 (SELECT count(*) FROM (
   SELECT user_id,bgg_id FROM public.user_game_collection UNION SELECT user_id,bgg_id FROM public.tier_placements UNION SELECT user_id,bgg_id FROM public.game_ratings
 ) t) AS unique_user_game_pairs,
 (SELECT jsonb_build_object('groups',count(*),'rows_in_groups',sum(n),'users',count(DISTINCT user_id)) FROM (
   SELECT p.user_id,g.category,p.tier,p.position,count(*) n FROM public.tier_placements p JOIN public.board_games g USING(bgg_id) GROUP BY 1,2,3,4 HAVING count(*)>1
 ) t) AS tied_positions,
 (SELECT jsonb_agg(t) FROM (
  SELECT conrelid::regclass::text AS table_name,conname,pg_get_constraintdef(c.oid) AS definition
  FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
  WHERE n.nspname='public' AND c.contype='f' AND NOT EXISTS (
   SELECT 1 FROM pg_index i WHERE i.indrelid=c.conrelid AND i.indisvalid AND i.indpred IS NULL AND
     (i.indkey::smallint[])[0:cardinality(c.conkey)-1] @> c.conkey)
 ) t) AS foreign_keys_without_leading_index,
 (SELECT jsonb_agg(t) FROM (
  SELECT a.indrelid::regclass::text AS table_name,a.indexrelid::regclass::text AS first_index,b.indexrelid::regclass::text AS second_index
  FROM pg_index a JOIN pg_index b ON a.indrelid=b.indrelid AND a.indexrelid<b.indexrelid
  JOIN pg_class c ON c.oid=a.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND a.indkey=b.indkey AND a.indclass=b.indclass AND a.indcollation=b.indcollation
    AND a.indoption=b.indoption AND a.indpred IS NOT DISTINCT FROM b.indpred AND a.indexprs IS NOT DISTINCT FROM b.indexprs
 ) t) AS same_key_indexes;

-- Check: live constraints, nullable columns, indexes, and RLS state.
SELECT
 (SELECT jsonb_agg(t ORDER BY t.table_name,t.conname) FROM (
   SELECT c.relname AS table_name,co.conname,pg_get_constraintdef(co.oid) AS definition
   FROM pg_constraint co JOIN pg_class c ON c.oid=co.conrelid
   JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
 ) t) AS constraints,
 (SELECT jsonb_agg(t ORDER BY t.table_name,t.ordinal_position) FROM (
   SELECT table_name,column_name,is_nullable,ordinal_position FROM information_schema.columns
   WHERE table_schema='public'
 ) t) AS columns,
 (SELECT jsonb_agg(t ORDER BY t.relname,t.indexrelname) FROM (
   SELECT s.relname,s.indexrelname,s.idx_scan,pg_relation_size(s.indexrelid) AS bytes,
          pg_get_indexdef(s.indexrelid) AS definition,i.indisunique,i.indisprimary,i.indisvalid
   FROM pg_stat_user_indexes s JOIN pg_index i ON i.indexrelid=s.indexrelid
   WHERE s.schemaname='public'
 ) t) AS indexes,
 (SELECT relrowsecurity FROM pg_class WHERE oid='public.score_snapshots'::regclass) AS snapshots_rls,
 (SELECT rolbypassrls FROM pg_roles WHERE rolname='authenticated') AS authenticated_bypass;

-- Check: canonical-score comparison, excluding ambiguous rankings and rounding noise.
WITH ambiguous AS (
 SELECT DISTINCT user_id,category FROM (
  SELECT p.user_id,g.category,p.tier,p.position FROM public.tier_placements p JOIN public.board_games g USING(bgg_id)
  GROUP BY 1,2,3,4 HAVING count(*)>1) t
), ranked AS (
 SELECT p.*,g.category,
 row_number() OVER(PARTITION BY p.user_id,g.category ORDER BY array_position(ARRAY['S','A','B','C','D','F'],tier),position,p.bgg_id) AS rank,
 count(*) OVER(PARTITION BY p.user_id,g.category) AS total
 FROM public.tier_placements p JOIN public.board_games g USING(bgg_id)
), expected AS (
 SELECT *,CASE WHEN total=1 THEN 10 ELSE round(10-(rank-1)*9::numeric/(total-1),1) END AS expected FROM ranked
)
SELECT
 (SELECT jsonb_build_object('rows',count(*),'users',count(DISTINCT user_id),'max_difference',max(abs(score-expected)))
  FROM expected WHERE score IS DISTINCT FROM expected) AS all_score_differences,
 (SELECT jsonb_build_object('rows',count(*),'users',count(DISTINCT user_id),'max_difference',max(abs(score-expected)))
  FROM expected e WHERE abs(score-expected)>0.1 AND NOT EXISTS (
   SELECT 1 FROM ambiguous a WHERE a.user_id=e.user_id AND a.category=e.category
  )) AS unambiguous_differences_above_rounding,
 (SELECT jsonb_agg(t) FROM (
   SELECT user_id IS NULL AS community,count(*) AS rows,min(snapshot_at) AS earliest,max(snapshot_at) AS latest
   FROM public.score_snapshots GROUP BY 1
 ) t) AS history_by_type;

ROLLBACK;
