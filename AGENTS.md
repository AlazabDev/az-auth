# Architecture rules

- Admin provider health reads Supabase's public auth settings, not the local provider registry, because registry flags do not prove hosted activation.
- Keep provider activation, auth-service reachability, and completed sign-in verification separate; public settings cannot prove credentials, tenant restrictions, or OTP delivery.
- Never collect provider secrets in the health page; provider configuration stays in the external Supabase dashboard.
- Chat invokes a persisted Foundry agent server-side; OTP delivery uses public Supabase Auth independently of AI so provider failures cannot block verification or bypass Auth abuse controls.
- MCP account tools fail closed until per-user authorization and verified schemas exist; a shared agent token is not proof of an end user's identity.
- Chat history is tab-scoped and excludes attachment contents because account conversations must not persist across shared-browser sessions.