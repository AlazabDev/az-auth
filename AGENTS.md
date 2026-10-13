# Architecture rules

- Admin provider health reads Supabase's public auth settings, not the local provider registry, because registry flags do not prove hosted activation.
- Keep provider activation, auth-service reachability, and completed sign-in verification separate; public settings cannot prove credentials, tenant restrictions, or OTP delivery.
- Never collect provider secrets in the health page; provider configuration stays in the external Supabase dashboard.