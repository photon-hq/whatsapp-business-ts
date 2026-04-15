/**
 * Maps between proto generated types and SDK public types.
 *
 * Proto imports are prefixed with `Proto` to distinguish from the SDK types
 * that share similar names.
 */

import type {
  ContactCard as ProtoContactCard,
  ContactName as ProtoContactName,
  ContactPhone as ProtoContactPhone,
  ContactEmail as ProtoContactEmail,
  ContactAddress as ProtoContactAddress,
  ContactOrg as ProtoContactOrg,
  ContactUrl as ProtoContactUrl,
  Event as ProtoEvent,
  InboundMessage as ProtoInboundMessage,
  InteractiveContent as ProtoInteractiveContent,
  InteractiveHeader as ProtoInteractiveHeader,
  InteractiveAction as ProtoInteractiveAction,
  InteractiveButton as ProtoInteractiveButton,
  InteractiveSection as ProtoInteractiveSection,
  InteractiveFlowParameters as ProtoInteractiveFlowParameters,
  MediaContent as ProtoMediaContent,
  SendMessageRequest as ProtoSendMessageRequest,
  StatusUpdate as ProtoStatusUpdate,
  SubscribeEventsResponse as ProtoSubscribeEventsResponse,
  TemplateContent as ProtoTemplateContent,
  TemplateComponent as ProtoTemplateComponent,
  TemplateCard as ProtoTemplateCard,
  TemplateParameter as ProtoTemplateParameter,
} from "../generated/photon/whatsapp/v1/message_service.ts";
import { MessageStatus as ProtoMessageStatus } from "../generated/photon/whatsapp/v1/message_service.ts";
import type {
  ContactCard,
  ContactName,
  ContactPhone,
  ContactEmail,
  ContactAddress,
  ContactOrg,
  ContactUrl,
  Conversation,
  InboundButton,
  InboundInteractive,
  InboundMedia,
  InboundSticker,
  Location,
  MessageContext,
  Order,
  OrderProductItem,
  Pricing,
  Reaction,
  Referral,
  SystemMessage,
  WhatsAppApiError,
} from "../types/common.ts";
import type {
  InboundContent,
  InboundMessage,
  MessageStatus,
  StatusUpdate,
  WhatsAppEvent,
} from "../types/events.ts";
import type {
  ContactCardInput,
  InteractiveActionInput,
  InteractiveButtonInput,
  InteractiveFlowParametersInput,
  InteractiveHeaderInput,
  InteractiveInput,
  InteractiveSectionInput,
  MediaInput,
  SendMessageParams,
  TemplateCardInput,
  TemplateComponentInput,
  TemplateInput,
  TemplateParameterInput,
} from "../types/messages.ts";

// ---------------------------------------------------------------------------
// Outbound: SDK → Proto
// ---------------------------------------------------------------------------

export function mapSendParams(
  params: SendMessageParams,
): ProtoSendMessageRequest {
  const base: Partial<ProtoSendMessageRequest> = {
    to: params.to,
    replyToMessageId: params.replyTo,
    bizOpaqueCallbackData: params.bizOpaqueCallbackData,
    contacts: [],
  };

  if ("text" in params) {
    const text = params.text;
    if (typeof text === "string") {
      return { ...base, text: { body: text } } as ProtoSendMessageRequest;
    }
    return {
      ...base,
      text: { body: text.body, previewUrl: text.previewUrl },
    } as ProtoSendMessageRequest;
  }

  if ("image" in params) {
    return { ...base, image: mapMediaInput(params.image) } as ProtoSendMessageRequest;
  }
  if ("video" in params) {
    return { ...base, video: mapMediaInput(params.video) } as ProtoSendMessageRequest;
  }
  if ("audio" in params) {
    return { ...base, audio: mapMediaInput(params.audio) } as ProtoSendMessageRequest;
  }
  if ("document" in params) {
    return { ...base, document: mapMediaInput(params.document) } as ProtoSendMessageRequest;
  }
  if ("sticker" in params) {
    return {
      ...base,
      sticker: { id: params.sticker.id, link: params.sticker.link },
    } as ProtoSendMessageRequest;
  }
  if ("location" in params) {
    return {
      ...base,
      location: {
        latitude: params.location.latitude,
        longitude: params.location.longitude,
        name: params.location.name,
        address: params.location.address,
      },
    } as ProtoSendMessageRequest;
  }
  if ("reaction" in params) {
    return {
      ...base,
      reaction: {
        messageId: params.reaction.messageId,
        emoji: params.reaction.emoji,
      },
    } as ProtoSendMessageRequest;
  }
  if ("interactive" in params) {
    return {
      ...base,
      interactive: mapInteractiveInput(params.interactive),
    } as ProtoSendMessageRequest;
  }
  if ("template" in params) {
    return {
      ...base,
      template: mapTemplateInput(params.template),
    } as ProtoSendMessageRequest;
  }
  if ("contacts" in params) {
    return {
      ...base,
      contacts: params.contacts.map(mapContactCardInput),
    } as ProtoSendMessageRequest;
  }

  return base as ProtoSendMessageRequest;
}

function mapMediaInput(input: MediaInput): ProtoMediaContent {
  return {
    id: input.id,
    link: input.link,
    caption: input.caption,
    filename: input.filename,
    mimeType: input.mimeType,
  };
}

function mapInteractiveInput(
  input: InteractiveInput,
): ProtoInteractiveContent {
  return {
    type: input.type,
    header: input.header ? mapInteractiveHeaderInput(input.header) : undefined,
    body: input.body ? { text: input.body } : undefined,
    footer: input.footer ? { text: input.footer } : undefined,
    action: input.action ? mapInteractiveActionInput(input.action) : undefined,
  };
}

function mapInteractiveHeaderInput(
  input: InteractiveHeaderInput,
): ProtoInteractiveHeader {
  return {
    type: input.type,
    text: input.text,
    image: input.image ? mapMediaInput(input.image) : undefined,
    video: input.video ? mapMediaInput(input.video) : undefined,
    document: input.document ? mapMediaInput(input.document) : undefined,
  };
}

function mapInteractiveActionInput(
  input: InteractiveActionInput,
): ProtoInteractiveAction {
  return {
    buttons: input.buttons?.map(mapInteractiveButtonInput) ?? [],
    button: input.button,
    sections: input.sections?.map(mapInteractiveSectionInput) ?? [],
    catalogId: input.catalogId,
    productRetailerId: input.productRetailerId,
    name: input.name,
    parameters: input.parameters
      ? mapFlowParametersInput(input.parameters)
      : undefined,
  };
}

function mapInteractiveButtonInput(
  input: InteractiveButtonInput,
): ProtoInteractiveButton {
  return {
    type: input.type,
    reply: { id: input.reply.id, title: input.reply.title },
  };
}

function mapInteractiveSectionInput(
  input: InteractiveSectionInput,
): ProtoInteractiveSection {
  return {
    title: input.title,
    rows:
      input.rows?.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
      })) ?? [],
    productItems:
      input.productItems?.map((p) => ({
        productRetailerId: p.productRetailerId,
      })) ?? [],
  };
}

function mapFlowParametersInput(
  input: InteractiveFlowParametersInput,
): ProtoInteractiveFlowParameters {
  return {
    flowMessageVersion: input.flowMessageVersion,
    flowToken: input.flowToken,
    flowId: input.flowId,
    flowCta: input.flowCta,
    flowAction: input.flowAction,
    flowActionPayloadJson: input.flowActionPayloadJson,
  };
}

function mapTemplateInput(input: TemplateInput): ProtoTemplateContent {
  return {
    name: input.name,
    languageCode: input.languageCode,
    components: input.components?.map(mapTemplateComponentInput) ?? [],
  };
}

function mapTemplateComponentInput(
  input: TemplateComponentInput,
): ProtoTemplateComponent {
  return {
    type: input.type,
    parameters: input.parameters?.map(mapTemplateParameterInput) ?? [],
    subType: input.subType,
    index: input.index,
    cards: input.cards?.map(mapTemplateCardInput) ?? [],
  };
}

function mapTemplateCardInput(input: TemplateCardInput): ProtoTemplateCard {
  return {
    cardIndex: input.cardIndex,
    components: input.components.map(mapTemplateComponentInput),
  };
}

function mapTemplateParameterInput(
  input: TemplateParameterInput,
): ProtoTemplateParameter {
  const base: Partial<ProtoTemplateParameter> = { type: input.type };

  if (input.text !== undefined) return { ...base, text: input.text } as ProtoTemplateParameter;
  if (input.image) return { ...base, image: mapMediaInput(input.image) } as ProtoTemplateParameter;
  if (input.video) return { ...base, video: mapMediaInput(input.video) } as ProtoTemplateParameter;
  if (input.document) return { ...base, document: mapMediaInput(input.document) } as ProtoTemplateParameter;
  if (input.location) {
    return {
      ...base,
      location: {
        latitude: input.location.latitude,
        longitude: input.location.longitude,
        name: input.location.name,
        address: input.location.address,
      },
    } as ProtoTemplateParameter;
  }
  if (input.payload !== undefined) return { ...base, payload: input.payload } as ProtoTemplateParameter;
  if (input.couponCode !== undefined) return { ...base, couponCode: input.couponCode } as ProtoTemplateParameter;
  if (input.actionJson !== undefined) return { ...base, actionJson: input.actionJson } as ProtoTemplateParameter;

  return base as ProtoTemplateParameter;
}

function mapContactCardInput(input: ContactCardInput): ProtoContactCard {
  return {
    name: {
      formattedName: input.name.formattedName,
      firstName: input.name.firstName,
      lastName: input.name.lastName,
      middleName: input.name.middleName,
      prefix: input.name.prefix,
      suffix: input.name.suffix,
    },
    phones: input.phones.map((p) => ({
      phone: p.phone,
      type: p.type,
      waId: p.waId,
    })),
    emails: input.emails.map((e) => ({ email: e.email, type: e.type })),
    addresses: input.addresses.map((a) => ({
      street: a.street,
      city: a.city,
      state: a.state,
      zip: a.zip,
      country: a.country,
      countryCode: a.countryCode,
      type: a.type,
    })),
    org: input.org
      ? {
          company: input.org.company,
          department: input.org.department,
          title: input.org.title,
        }
      : undefined,
    urls: input.urls.map((u) => ({ url: u.url, type: u.type })),
    birthday: input.birthday,
  };
}

// ---------------------------------------------------------------------------
// Inbound: Proto → SDK
// ---------------------------------------------------------------------------

export function mapEvent(
  proto: ProtoSubscribeEventsResponse,
): WhatsAppEvent | null {
  const cursor = proto.cursor?.value ?? "";

  if (proto.message) {
    return {
      type: "message",
      cursor,
      message: mapInboundMessage(proto.message),
    };
  }

  if (proto.status) {
    return {
      type: "status",
      cursor,
      status: mapStatusUpdate(proto.status),
    };
  }

  // Heartbeat or unknown payload — silently discard.
  return null;
}

export function mapMissedEvent(proto: ProtoEvent): WhatsAppEvent | null {
  const cursor = proto.cursor?.value ?? "";

  if (proto.message) {
    return {
      type: "message",
      cursor,
      message: mapInboundMessage(proto.message),
    };
  }

  if (proto.status) {
    return {
      type: "status",
      cursor,
      status: mapStatusUpdate(proto.status),
    };
  }

  return null;
}

export function mapInboundMessage(
  proto: ProtoInboundMessage,
): InboundMessage {
  return {
    id: proto.id,
    from: proto.from,
    timestamp: proto.timestamp ?? new Date(0),
    messageType: proto.type,
    contact: proto.contact
      ? { waId: proto.contact.waId, name: proto.contact.name }
      : undefined,
    content: mapInboundContent(proto),
    context: proto.context
      ? {
          forwarded: proto.context.forwarded,
          frequentlyForwarded: proto.context.frequentlyForwarded,
          from: proto.context.from,
          id: proto.context.id,
          referredProduct: proto.context.referredProduct
            ? {
                catalogId: proto.context.referredProduct.catalogId,
                productRetailerId:
                  proto.context.referredProduct.productRetailerId,
              }
            : undefined,
        }
      : undefined,
    referral: proto.referral
      ? {
          sourceUrl: proto.referral.sourceUrl,
          sourceType: proto.referral.sourceType,
          sourceId: proto.referral.sourceId,
          headline: proto.referral.headline,
          body: proto.referral.body,
        }
      : undefined,
    errors: proto.errors.map(mapApiError),
  };
}

function mapInboundContent(proto: ProtoInboundMessage): InboundContent {
  switch (proto.type) {
    case "text":
      return { type: "text", body: proto.text?.body ?? "" };
    case "image":
      return { type: "image", media: mapInboundMedia(proto.image!) };
    case "video":
      return { type: "video", media: mapInboundMedia(proto.video!) };
    case "audio":
      return { type: "audio", media: mapInboundMedia(proto.audio!) };
    case "document":
      return { type: "document", media: mapInboundMedia(proto.document!) };
    case "sticker":
      return {
        type: "sticker",
        sticker: {
          id: proto.sticker!.id,
          mimeType: proto.sticker!.mimeType,
          sha256: proto.sticker!.sha256,
          animated: proto.sticker!.animated,
        },
      };
    case "location":
      return {
        type: "location",
        location: {
          latitude: proto.location!.latitude,
          longitude: proto.location!.longitude,
          name: proto.location!.name,
          address: proto.location!.address,
        },
      };
    case "contacts":
      return {
        type: "contacts",
        contacts: proto.contacts.map(mapInboundContactCard),
      };
    case "reaction":
      return {
        type: "reaction",
        reaction: {
          messageId: proto.reaction!.messageId,
          emoji: proto.reaction!.emoji,
        },
      };
    case "interactive":
      return {
        type: "interactive",
        interactive: mapInboundInteractive(proto.interactive!),
      };
    case "button":
      return {
        type: "button",
        button: {
          text: proto.button!.text,
          payload: proto.button!.payload,
        },
      };
    case "order":
      return {
        type: "order",
        order: {
          catalogId: proto.order!.catalogId,
          productItems: proto.order!.productItems.map((p) => ({
            productRetailerId: p.productRetailerId,
            quantity: p.quantity,
            itemPrice: p.itemPrice,
            currency: p.currency,
          })),
          text: proto.order!.text,
        },
      };
    case "system":
      return {
        type: "system",
        system: {
          body: proto.system!.body,
          type: proto.system!.type,
          newWaId: proto.system!.newWaId,
          waId: proto.system!.waId,
        },
      };
    default:
      return { type: "unknown" };
  }
}

function mapInboundMedia(
  proto: {
    id: string;
    mimeType: string;
    sha256?: string;
    caption?: string;
    filename?: string;
    voice?: boolean;
  },
): InboundMedia {
  return {
    id: proto.id,
    mimeType: proto.mimeType,
    sha256: proto.sha256,
    caption: proto.caption,
    filename: proto.filename,
    voice: proto.voice,
  };
}

function mapInboundInteractive(
  proto: { type: string; buttonReply?: { id: string; title: string }; listReply?: { id: string; title: string; description?: string }; nfmReply?: { name?: string; body?: string; responseJson: string } },
): InboundInteractive {
  if (proto.buttonReply) {
    return {
      type: "button_reply",
      reply: { id: proto.buttonReply.id, title: proto.buttonReply.title },
    };
  }
  if (proto.listReply) {
    return {
      type: "list_reply",
      reply: {
        id: proto.listReply.id,
        title: proto.listReply.title,
        description: proto.listReply.description,
      },
    };
  }
  if (proto.nfmReply) {
    return {
      type: "nfm_reply",
      reply: {
        name: proto.nfmReply.name,
        body: proto.nfmReply.body,
        responseJson: proto.nfmReply.responseJson,
      },
    };
  }
  // Fallback — shouldn't happen but satisfy types.
  return {
    type: "button_reply",
    reply: { id: "", title: "" },
  };
}

function mapInboundContactCard(proto: ProtoContactCard): ContactCard {
  return {
    name: {
      formattedName: proto.name?.formattedName ?? "",
      firstName: proto.name?.firstName,
      lastName: proto.name?.lastName,
      middleName: proto.name?.middleName,
      prefix: proto.name?.prefix,
      suffix: proto.name?.suffix,
    },
    phones: proto.phones.map((p) => ({
      phone: p.phone,
      type: p.type,
      waId: p.waId,
    })),
    emails: proto.emails.map((e) => ({ email: e.email, type: e.type })),
    addresses: proto.addresses.map((a) => ({
      street: a.street,
      city: a.city,
      state: a.state,
      zip: a.zip,
      country: a.country,
      countryCode: a.countryCode,
      type: a.type,
    })),
    org: proto.org
      ? {
          company: proto.org.company,
          department: proto.org.department,
          title: proto.org.title,
        }
      : undefined,
    urls: proto.urls.map((u) => ({ url: u.url, type: u.type })),
    birthday: proto.birthday,
  };
}

function mapStatusUpdate(proto: ProtoStatusUpdate): StatusUpdate {
  return {
    id: proto.id,
    status: mapMessageStatus(proto.status),
    timestamp: proto.timestamp ?? new Date(0),
    recipientId: proto.recipientId,
    conversation: proto.conversation
      ? {
          id: proto.conversation.id,
          originType: proto.conversation.originType,
          expiration: proto.conversation.expiration,
        }
      : undefined,
    pricing: proto.pricing
      ? {
          billable: proto.pricing.billable,
          pricingModel: proto.pricing.pricingModel,
          type: proto.pricing.type,
          category: proto.pricing.category,
        }
      : undefined,
    errors: proto.errors.map(mapApiError),
    bizOpaqueCallbackData: proto.bizOpaqueCallbackData,
  };
}

function mapMessageStatus(proto: ProtoMessageStatus): MessageStatus {
  switch (proto) {
    case ProtoMessageStatus.MESSAGE_STATUS_SENT:
      return "sent";
    case ProtoMessageStatus.MESSAGE_STATUS_DELIVERED:
      return "delivered";
    case ProtoMessageStatus.MESSAGE_STATUS_READ:
      return "read";
    case ProtoMessageStatus.MESSAGE_STATUS_PLAYED:
      return "played";
    case ProtoMessageStatus.MESSAGE_STATUS_FAILED:
      return "failed";
    default:
      return "sent";
  }
}

function mapApiError(proto: { code: number; title: string; message?: string; details?: string; href?: string }): WhatsAppApiError {
  return {
    code: proto.code,
    title: proto.title,
    message: proto.message,
    details: proto.details,
    href: proto.href,
  };
}
