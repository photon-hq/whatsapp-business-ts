# @photon-ai/whatsapp-business

TypeScript SDK for the WhatsApp Business API. Send and receive messages over a managed gRPC gateway.

```bash
bun add @photon-ai/whatsapp-business
```

```ts
import { createClient } from "@photon-ai/whatsapp-business";

const client = createClient({
  accessToken: process.env.WA_ACCESS_TOKEN!,
  phoneNumberId: process.env.WA_PHONE_NUMBER_ID!,
  appSecret: process.env.WA_APP_SECRET!,
});

await client.messages.send({
  to: "+15551234567",
  text: "Hello from the SDK!",
});

for await (const event of client.events.subscribe()) {
  if (event.type === "message") {
    console.log(event.message);
  }
}
```

Full documentation lives at **[docs.photon.codes](https://docs.photon.codes)**.

---

## Get started

### 1. Spectrum Cloud (one-click setup)

Sign up at **[app.photon.codes](https://app.photon.codes)**, toggle WhatsApp on in your project, finish the guided config, and drop the credentials into [`spectrum-ts`](https://github.com/photon-hq/spectrum-ts) — our unified messaging SDK that wraps this package alongside iMessage, Terminal, and other platforms behind one type-safe API.

### 2. Bring your own Meta app

Use this SDK directly with credentials from a Meta WhatsApp app you own.

1. Create an app at **[developers.facebook.com](https://developers.facebook.com/apps)** and add the **WhatsApp** product. ([docs](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started))
2. Under **WhatsApp → API Setup**, copy your `phone_number_id`.
3. Generate a **permanent access token** via a System User — the token shown on the API Setup page expires in 24 hours, so don't use that one in production:
   1. Open **[Business Manager → Business Settings → System users](https://business.facebook.com/settings/system-users)**, click **Add**, and create a user with **Admin** role.
   2. **Assign assets** → pick your app (enable *Manage app*) and your WhatsApp account (enable *Manage WhatsApp Business Accounts*).
   3. Click **Generate new token**, select your app, and check the `whatsapp_business_messaging`, `whatsapp_business_management`, and `business_management` scopes. Copy the token — it never expires. ([docs](https://developers.facebook.com/docs/whatsapp/business-management-api/get-started))
4. Under **App Settings → Basic**, copy your `app_secret`.
5. Under **WhatsApp → Configuration**, set the webhook ([docs](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks)):
   - **Callback URL:** `https://whatsapp-business.spectrum.photon.codes/webhook`
   - **Verify token:** anything (the handshake always returns the challenge)
   - Subscribe to the `messages` field
6. Pass the three credentials to `createClient` — done.

The webhook endpoint is free, public, and shared across all developers. You don't register with us, and we never save your `access_token` or `app_secret`.

**Missed messages.** If your client disconnects, inbound webhooks are buffered as unverified payloads. On reconnect, call `client.events.fetchMissed({ cursor })` and they're verified with your `app_secret`, decoded, and returned alongside any other missed events.

---

## Development

```bash
bun install          # install dependencies
bun run generate     # regenerate protobuf types
bun run build        # generate + bundle with tsup
bun run check        # type-check
bun run lint         # lint with Biome
bun test             # run tests
```

## License

MIT
