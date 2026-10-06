import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [twoFactorClient({
    onTwoFactorRedirect: () => {
      window.dispatchEvent(new Event("vega-two-factor-required"));
    },
  })],
});
