import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Keep the default adapter behavior for a simple free deployment.
  // If you later add R2/KV-backed caching, this is the seam to extend.
});
