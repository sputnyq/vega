import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields, twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields({
    user: {
      role: { type: ["Admin", "Kundenberater"], required: true, input: false },
      mustChangePassword: { type: "boolean", required: true, input: false },
      blocked: { type: "boolean", required: true, input: false },
    },
  }), twoFactorClient({
    onTwoFactorRedirect: () => {
      window.dispatchEvent(new Event("vega-two-factor-required"));
    },
  })],
});
