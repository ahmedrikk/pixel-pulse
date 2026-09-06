-- Remove offers a source has not confirmed recently. The sync worker now also
-- performs this cleanup when a provider returns zero publishable claim links.
update public.free_game_offers
set status = 'expired', updated_at = now()
where status in ('active', 'upcoming')
  and last_seen_at < now() - interval '2 hours';
