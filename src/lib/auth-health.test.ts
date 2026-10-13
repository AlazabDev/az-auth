import { describe, expect, it } from "vitest";
import { parseAuthSettings, providerState } from "./auth-health";

describe("authentication health evidence", () => {
  it("reads actual provider enablement, not local registry flags", () => {
    const settings = parseAuthSettings({ external: { google: true, facebook: false } });
    expect(providerState(settings, "google")).toBe("enabled");
    expect(providerState(settings, "facebook")).toBe("disabled");
  });
  it("does not infer WhatsApp readiness from phone activation", () => {
    expect(providerState({ external: { phone: true } }, "whatsapp")).toBe("unknown");
  });
  it("keeps absent and failed provider observations unknown", () => {
    expect(providerState(null, "azure")).toBe("unknown");
    expect(providerState({ external: {} }, "github")).toBe("unknown");
  });
  it("rejects malformed responses and ignores non-boolean activation values", () => {
    expect(() => parseAuthSettings({ error: "unavailable" })).toThrow();
    expect(providerState(parseAuthSettings({ external: { google: "true" } }), "google")).toBe("unknown");
  });
});