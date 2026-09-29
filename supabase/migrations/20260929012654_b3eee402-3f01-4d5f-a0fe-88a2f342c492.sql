INSERT INTO public.sso_apps (slug, name_ar, name_en, description_ar, description_en, base_url, redirect_url, color, allowed_roles, is_active, sort_order)
VALUES (
  'outpost',
  'منصة العزب Outpost',
  'Alazab Outpost',
  'الدخول الموحد إلى منصة العزب الرئيسية برمز بوابة آمن',
  'Single sign-on into the main Alazab platform with a signed portal token',
  'https://alazab.com',
  'https://alazab.com/sso',
  '#FFB900',
  ARRAY['platform_owner','platform_admin','data_analyst','data_engineer']::text[],
  true,
  90
)
ON CONFLICT (slug) DO UPDATE SET
  base_url = EXCLUDED.base_url,
  redirect_url = EXCLUDED.redirect_url,
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  description_ar = EXCLUDED.description_ar,
  description_en = EXCLUDED.description_en,
  color = EXCLUDED.color,
  is_active = true,
  updated_at = now();