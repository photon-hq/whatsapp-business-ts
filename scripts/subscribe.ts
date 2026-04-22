/**
 * Interactive smoke-test client for Spectrum Cloud mode.
 *
 * Prompts for a project ID and phone_number_id, mints a LightAuth JWT with
 * sub=<projectId>, then opens `MessageService.SubscribeEvents` and prints
 * every event that arrives. Send a real WhatsApp message to the Business
 * number and it should show up here within ~100ms of Meta's webhook.
 *
 * Usage:
 *   bun run script:subscribe
 *
 * Optional env:
 *   GRPC_ADDRESS             Default: staging-whatsapp-business-grpc.spectrum.photon.codes:443
 *   LIGHTAUTH_ENDPOINT       Default: http://lightauth.internal
 *   SPECTRUM_CLOUD_ENDPOINT  Default: http://staging.spectrum-cloud.internal
 *   META_API_VERSION         Default: v25.0
 *   META_API_BASE_URL        Default: https://graph.facebook.com
 */

import { stdin as input, stdout as output } from "node:process";
import { createInterface, type Interface } from "node:readline/promises";
import { ChannelCredentials } from "@grpc/grpc-js";
import { createChannel, createClient, Metadata } from "nice-grpc";
import { MessageServiceDefinition } from "../src/generated/photon/whatsapp/v1/message_service";

const INBOUND_SERVICE = "codes.photon.spectrum.whatsapp-business";

const grpcAddress =
  process.env.GRPC_ADDRESS ??
  "staging-whatsapp-business-grpc.spectrum.photon.codes:443";
const lightauthEndpoint =
  process.env.LIGHTAUTH_ENDPOINT ?? "http://lightauth.internal";
const spectrumCloudEndpoint =
  process.env.SPECTRUM_CLOUD_ENDPOINT ??
  "http://staging.spectrum-cloud.internal";
const metaApiVersion = process.env.META_API_VERSION ?? "v25.0";
const metaApiBaseUrl =
  process.env.META_API_BASE_URL ?? "https://graph.facebook.com";

function isLocalAddress(address: string): boolean {
  const host = address.split(":")[0] ?? "";
  return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
}

const credentials = isLocalAddress(grpcAddress)
  ? ChannelCredentials.createInsecure()
  : ChannelCredentials.createSsl();

async function promptRequired(rl: Interface, label: string): Promise<string> {
  const value = (await rl.question(`${label}: `)).trim();
  if (!value) {
    console.error(`${label} is required`);
    process.exit(1);
  }
  return value;
}

async function issueJwt(projectId: string): Promise<string> {
  const res = await fetch(`${lightauthEndpoint}/tokens/issue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serviceName: INBOUND_SERVICE,
      subject: projectId,
      expiresIn: 3600,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `LightAuth token issue failed: ${res.status} ${await res.text()}`
    );
  }
  const { token } = (await res.json()) as { token: string };
  return token;
}

async function verifyPhoneNumber(
  projectId: string,
  phoneNumberId: string
): Promise<string> {
  const url = `${spectrumCloudEndpoint}/projects/${projectId}/whatsapp-business/verify`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumberId }),
  });
  if (!res.ok) {
    throw new Error(
      `Spectrum Cloud verify failed: ${res.status} ${await res.text()}`
    );
  }
  const body = (await res.json()) as {
    succeed: true;
    data: { verified: true; metaBusinessToken: string } | { verified: false };
  };
  if (!body.data.verified) {
    throw new Error("phone_number_id is not registered under this project");
  }
  return body.data.metaBusinessToken;
}

async function fetchDisplayNumber(
  phoneNumberId: string,
  metaBusinessToken: string
): Promise<{ displayPhoneNumber?: string; verifiedName?: string }> {
  const url = `${metaApiBaseUrl}/${metaApiVersion}/${phoneNumberId}?fields=display_phone_number,verified_name`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${metaBusinessToken}` },
  });
  if (!res.ok) {
    throw new Error(
      `Meta Graph fetch failed: ${res.status} ${await res.text()}`
    );
  }
  const body = (await res.json()) as {
    display_phone_number?: string;
    verified_name?: string;
  };
  return {
    displayPhoneNumber: body.display_phone_number,
    verifiedName: body.verified_name,
  };
}

const rl = createInterface({ input, output });
const projectId = await promptRequired(rl, "project ID");
const phoneNumberId = await promptRequired(rl, "phone_number_id");
rl.close();

console.log(`[subscribe] minting JWT via ${lightauthEndpoint} ...`);
const accessToken = await issueJwt(projectId);
console.log("[subscribe] JWT issued");

try {
  console.log(
    `[subscribe] resolving display number via ${spectrumCloudEndpoint} ...`
  );
  const metaBusinessToken = await verifyPhoneNumber(projectId, phoneNumberId);
  const { displayPhoneNumber, verifiedName } = await fetchDisplayNumber(
    phoneNumberId,
    metaBusinessToken
  );
  console.log(
    `[subscribe] phone: ${displayPhoneNumber ?? "?"} (${verifiedName ?? "no verified name"})`
  );
} catch (err) {
  console.warn(
    "[subscribe] failed to resolve display number (continuing anyway):",
    err instanceof Error ? err.message : err
  );
}

const channel = createChannel(grpcAddress, credentials);
const client = createClient(MessageServiceDefinition, channel);

const metadata = Metadata({
  access_token: accessToken,
  phone_number_id: phoneNumberId,
});

const abort = new AbortController();
process.on("SIGINT", () => {
  console.log("\n[subscribe] SIGINT received, closing stream");
  abort.abort();
});

console.log(
  `[subscribe] connected to ${grpcAddress}, streaming events for phone_number_id=${phoneNumberId}`
);
console.log("[subscribe] send a WhatsApp message to the Business number...");

try {
  for await (const event of client.subscribeEvents(
    {},
    { metadata, signal: abort.signal }
  )) {
    if (event.heartbeat) {
      console.log(`[subscribe] heartbeat ${new Date().toISOString()}`);
      continue;
    }

    if (event.message) {
      console.log(
        `[subscribe] message cursor=${event.cursor?.value ?? "?"} from=${event.message.from} type=${event.message.type}`
      );
      console.log(JSON.stringify(event.message, null, 2));
      continue;
    }

    if (event.status) {
      console.log(
        `[subscribe] status cursor=${event.cursor?.value ?? "?"} id=${event.status.id} status=${event.status.status}`
      );
      console.log(JSON.stringify(event.status, null, 2));
      continue;
    }

    console.log("[subscribe] unknown event", event);
  }
  console.log("[subscribe] stream ended");
} catch (err) {
  if (abort.signal.aborted) {
    process.exit(0);
  }
  console.error("[subscribe] error", err);
  process.exit(1);
} finally {
  channel.close();
}
