import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, ExternalLink, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import logoOnLight from "@/assets/brand/alazab-on-light.png";
import logoOnDark from "@/assets/brand/alazab-on-dark.png";

const OAuthConsentPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authorizationId = searchParams.get("authorization_id");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clientName, setClientName] = useState("Application");
  const [redirectUri, setRedirectUri] = useState("");
  const [scope, setScope] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadAuthorization = async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        setLoading(false);
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (userError || !user) {
        const returnPath = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
        sessionStorage.setItem("alazab_oauth_return_to", returnPath);
        navigate("/auth/login", { replace: true });
        return;
      }

      const { data, error: detailsError } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);

      if (cancelled) return;

      if (detailsError || !data) {
        setError(detailsError?.message || "Invalid OAuth authorization request");
        setLoading(false);
        return;
      }

      if (!("authorization_id" in data) && "redirect_url" in data && data.redirect_url) {
        window.location.replace(data.redirect_url);
        return;
      }

      if ("client" in data && data.client) {
        setClientName(data.client.name || "Application");
      }
      if ("redirect_uri" in data) {
        setRedirectUri(data.redirect_uri || "");
      }
      if ("scope" in data) {
        setScope(data.scope || "");
      }
      setLoading(false);
    };

    void loadAuthorization();

    return () => {
      cancelled = true;
    };
  }, [authorizationId, navigate]);

  const handleDecision = async (decision: "approve" | "deny") => {
    if (!authorizationId || submitting) return;

    setSubmitting(decision);
    setError(null);

    const result =
      decision === "approve"
        ? await supabase.auth.oauth.approveAuthorization(authorizationId)
        : await supabase.auth.oauth.denyAuthorization(authorizationId);

    if (result.error || !result.data?.redirect_url) {
      setError(result.error?.message || "Unable to complete OAuth authorization");
      setSubmitting(null);
      return;
    }

    window.location.replace(result.data.redirect_url);
  };

  const scopes = scope
    .split(" ")
    .map((item) => item.trim())
    .filter(Boolean);

  const scopeLabels: Record<string, string> = {
    openid: "Verify your Alazab identity",
    email: "Access your email address",
    profile: "Access your basic profile information",
    phone: "Access your phone number",
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5 py-10 relative overflow-hidden">
      <div className="absolute inset-0 bg-dot-pattern opacity-20 pointer-events-none" />
      <div className="absolute -top-32 -right-24 h-80 w-80 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-36 -left-24 h-96 w-96 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

      <motion.main
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative z-10 w-full max-w-lg"
      >
        <section className="rounded-3xl border border-border/70 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="px-7 pt-8 pb-6 text-center border-b border-border/60">
            <div className="relative w-20 h-20 mx-auto mb-5">
              <div className="absolute inset-0 rounded-2xl bg-primary/10 blur-xl" />
              <div className="relative w-full h-full rounded-2xl border border-border/60 bg-background p-2 shadow-lg">
                <img src={logoOnLight} alt="Alazab" className="w-full h-full object-contain dark:hidden" />
                <img src={logoOnDark} alt="Alazab" className="w-full h-full object-contain hidden dark:block" />
              </div>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary mb-4">
              <ShieldCheck className="w-3.5 h-3.5" />
              Alazab Secure Authorization
            </div>

            <h1 className="font-heading text-2xl font-extrabold text-foreground">Authorize access</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Review the application request before allowing it to access your Alazab account.
            </p>
          </div>

          <div className="p-7">
            {loading ? (
              <div className="py-12 flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
                <span className="text-sm">Loading authorization request…</span>
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
                <div className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">Authorization request failed</p>
                    <p className="text-sm text-muted-foreground mt-1 break-words">{error}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-2xl border border-border bg-muted/30 p-5">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Requesting application</p>
                  <p className="font-heading text-xl font-bold text-foreground">{clientName}</p>
                  {redirectUri && (
                    <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground break-all">
                      <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{redirectUri}</span>
                    </div>
                  )}
                </div>

                <div>
                  <h2 className="text-sm font-bold text-foreground mb-3">This application is requesting:</h2>
                  <div className="space-y-2.5">
                    {(scopes.length ? scopes : ["email"]).map((item) => (
                      <div key={item} className="flex items-center gap-3 rounded-xl border border-border/70 px-4 py-3">
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{scopeLabels[item] || item}</p>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">{item}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-muted-foreground">
                  Approval grants this OAuth client access under your signed-in identity. You can revoke authorized applications later from your account security settings.
                </p>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={submitting !== null}
                    onClick={() => void handleDecision("deny")}
                    className="h-12 rounded-xl"
                  >
                    {submitting === "deny" ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    Deny
                  </Button>
                  <Button
                    type="button"
                    disabled={submitting !== null}
                    onClick={() => void handleDecision("approve")}
                    className="h-12 rounded-xl font-bold"
                  >
                    {submitting === "approve" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    Allow
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>
      </motion.main>
    </div>
  );
};

export default OAuthConsentPage;
