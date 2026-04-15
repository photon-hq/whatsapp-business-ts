# @photon-ai/whatsapp-business

TypeScript SDK for the WhatsApp Business API via Photon's Spectrum gRPC gateway.

## Installation

```bash
bun add @photon-ai/whatsapp-business
```

## Quick start

```ts
import { createClient } from "@photon-ai/whatsapp-business";

const client = createClient({
  accessToken: process.env.WA_ACCESS_TOKEN!,
  phoneNumberId: process.env.WA_PHONE_NUMBER_ID!,
  appSecret: process.env.WA_APP_SECRET!,
});

// Send a text message
await client.messages.send({
  to: "+1234567890",
  text: { body: "Hello from the SDK!" },
});

// Subscribe to inbound events
const stream = client.events.subscribe();
for await (const event of stream) {
  console.log(event);
}

await client.close();
```

## Configuration

| Environment variable | Description | Default |
| --- | --- | --- |
| `WHATSAPP_BUSINESS_ENDPOINT` | gRPC server address (host:port) | `whatsapp-business-grpc.spectrum.photon.codes:443` |

## Development

```bash
bun install          # install dependencies
bun run generate     # regenerate protobuf types
bun run build        # generate + bundle with tsup
bun run check        # type-check
bun run lint         # lint with Biome
bun run lint:fix     # auto-fix lint issues
bun test             # run tests
```
