/**
 * scripts/cf-email-aliases.mjs
 *
 * Creates all iku.gg email forwarding aliases via Cloudflare Email Routing API.
 * All aliases forward to a single verified destination email.
 *
 * Prerequisite: the destination email must already be verified in Cloudflare
 * (user clicks the confirmation link sent by CF).
 *
 * ENV:
 *   CF_API_TOKEN     — Cloudflare API token with Email:Edit + Zone:Read
 *   CF_ZONE_ID       — iku.gg zone id
 *   EMAIL_DESTINATION — verified destination email (e.g. iku.media.gg@gmail.com)
 */

const TOKEN = process.env.CF_API_TOKEN;
const ZONE = process.env.CF_ZONE_ID;
const DESTINATION = process.env.EMAIL_DESTINATION;

if (!TOKEN || !ZONE || !DESTINATION) {
  console.error("Missing CF_API_TOKEN / CF_ZONE_ID / EMAIL_DESTINATION");
  process.exit(1);
}

const API = "https://api.cloudflare.com/client/v4";
const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(`${method} ${path}: ${JSON.stringify(data.errors)}`);
  }
  return data.result;
}

// ────────────────────────────────────────────────────────────────
// The full alias list for iku.gg
// ────────────────────────────────────────────────────────────────

const ALIASES = [
  // ─── General ───
  { name: "hello", description: "General inbound — public address on website" },
  { name: "contact", description: "Contact form + business inquiries" },
  { name: "info", description: "Generic info queries" },

  // ─── Support ───
  {
    name: "support",
    description: "User support — technical issues, account help",
  },
  { name: "help", description: "User help inbox" },
  { name: "feedback", description: "User feedback, feature requests" },

  // ─── Legal / compliance ───
  { name: "dmca", description: "DMCA takedown requests (legal requirement)" },
  { name: "abuse", description: "Report illegal content or abuse" },
  { name: "legal", description: "Legal inquiries from authorities, lawyers" },
  {
    name: "privacy",
    description: "GDPR + privacy questions (data deletion, etc.)",
  },
  { name: "2257", description: "2257 compliance + record keeping inquiries" },

  // ─── Business ───
  { name: "press", description: "Press inquiries, media kit requests" },
  { name: "partnerships", description: "Business partnerships, ad deals" },
  { name: "jobs", description: "Career inquiries (future)" },
  { name: "founder", description: "Direct line to the founder" },

  // ─── System ───
  {
    name: "dmarc",
    description: "DMARC reports aggregation (matches DMARC record)",
  },
  {
    name: "noreply",
    description: "Reserve — to block replies to automated emails",
  },
];

async function createRule(alias) {
  const ruleBody = {
    actions: [{ type: "forward", value: [DESTINATION] }],
    matchers: [{ type: "literal", field: "to", value: `${alias.name}@iku.gg` }],
    enabled: true,
    name: `Forward ${alias.name}@ — ${alias.description}`,
    priority: 0,
  };

  try {
    const result = await api(
      "POST",
      `/zones/${ZONE}/email/routing/rules`,
      ruleBody,
    );
    console.log(`  ✓ ${alias.name}@iku.gg → ${DESTINATION}`);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("already exists") || msg.includes("duplicate")) {
      console.log(`  = ${alias.name}@iku.gg (already exists)`);
      return null;
    }
    console.log(`  ❌ ${alias.name}@iku.gg: ${msg.slice(0, 120)}`);
    return null;
  }
}

async function run() {
  console.log(`📧 Creating ${ALIASES.length} email aliases for iku.gg\n`);
  console.log(`   All forward to: ${DESTINATION}\n`);

  for (const alias of ALIASES) {
    await createRule(alias);
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log("\n✨ Done");
}

run().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
