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

Use this SDK directly with credentials from a Meta WhatsApp app you own. You'll need three values: `phoneNumberId`, `accessToken`, and `appSecret`.

1. **Create the app.** At **[developers.facebook.com/apps](https://developers.facebook.com/apps)**, click **Create app**. Name the app, enter your email, toggle **"Connect with customers through WhatsApp"**, and click **Next**. Create a business portfolio (name + contact info), **Next**, then **Create app**. Your app dashboard opens automatically.

2. **Get your Phone Number ID.** In the dashboard, click **Use cases** → **Customize** under "Add use cases" → **API Setup** in the second sidebar. Under **From**, click **Generate new phone number** to create a test sender. The **Phone Number ID** appears directly below — copy it. To send test messages to yourself, open the **To** dropdown → **Manage phone number list** → add your own number.

   Ignore the blue **Generate Access Token** button on this page — that token expires in 24 hours. Step 3 generates a permanent one.

3. **Generate a permanent Access Token via a System User.** At **[Business Manager → System Users](https://business.facebook.com/settings/system-users)**:
   1. Click **Add**, name the user, set the role to **Admin**, then **Create system user**.
   2. Click the **three dots** next to "Revoke Tokens" → **Assign Assets** → toggle **Full Control** on for your app → **Save**.
   3. In the left sidebar under **Accounts**, click **WhatsApp accounts** → select your WhatsApp Business Account → **Assign People** → pick the system user → toggle **Full Control** → **Save**.
   4. Back on the system user, click **Generate token**. Select your app, check `whatsapp_business_messaging`, `whatsapp_business_management`, and `business_management`, set expiration to **Never**, and copy the token — this is your `accessToken`.

4. **Get your App Secret.** **My apps** → your app → **App settings** → **Basic**. Click **Show** next to App Secret and copy it.

5. **Configure the webhook.** In your app: **Use cases** → **API Setup** → scroll to **Step 3** → **Configure webhooks** ([docs](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks)):
   - **Callback URL:** `https://whatsapp-business.spectrum.photon.codes/webhook`
   - **Verify Token:** any value — Meta requires you to set one, but Photon's shared endpoint doesn't check it (so `hello` works as well as anything else)
   - Click **Verify and Save**, then toggle the `messages` field to **Subscribed**.

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
