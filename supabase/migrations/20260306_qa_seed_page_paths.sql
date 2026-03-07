-- =============================================================================
-- QA SEED PAGE PATHS
-- =============================================================================
-- Backfill page_path for existing qa_checks rows based on page_id.
-- =============================================================================

UPDATE public.qa_checks SET page_path = '/' WHERE page_id = 'landing';
UPDATE public.qa_checks SET page_path = '/portal/onboarding' WHERE page_id = 'portal-onboarding';
UPDATE public.qa_checks SET page_path = '/portal/checkin' WHERE page_id = 'portal-checkin';
UPDATE public.qa_checks SET page_path = '/portal/history' WHERE page_id = 'portal-history';
UPDATE public.qa_checks SET page_path = '/portal/goals' WHERE page_id = 'portal-goals';
UPDATE public.qa_checks SET page_path = '/dashboard' WHERE page_id = 'therapist-care';
UPDATE public.qa_checks SET page_path = '/cases' WHERE page_id = 'case-detail';
UPDATE public.qa_checks SET page_path = '/cases' WHERE page_id = 'case-list';
UPDATE public.qa_checks SET page_path = '/admin/status' WHERE page_id = 'practice-status';
UPDATE public.qa_checks SET page_path = '/admin/status' WHERE page_id = 'practice-health';
UPDATE public.qa_checks SET page_path = '/admin' WHERE page_id = 'admin-home';
UPDATE public.qa_checks SET page_path = '/admin/dev' WHERE page_id = 'admin-dev';
UPDATE public.qa_checks SET page_path = '/admin/dev' WHERE page_id = 'system-status';
UPDATE public.qa_checks SET page_path = '/status' WHERE page_id = 'product-health';
