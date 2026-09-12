REVOKE ALL ON FUNCTION public.create_notification(uuid, text, text, text, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user_profile() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_customer_on_status_change() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_rider_claimed() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_vendor_on_approval() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_vendor_on_new_order() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_vendor_on_review() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_vendor_rating() FROM anon, authenticated;