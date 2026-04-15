import type { ContactCard, Location, Reaction } from "./common.ts";

// ---------------------------------------------------------------------------
// Outbound content sub-types
// ---------------------------------------------------------------------------

export interface TextInput {
  readonly body: string;
  readonly previewUrl?: boolean;
}

export interface MediaInput {
  readonly caption?: string;
  readonly filename?: string;
  readonly id?: string;
  readonly link?: string;
  readonly mimeType?: string;
}

export type StickerInput = Pick<MediaInput, "id" | "link">;

export type LocationInput = Location;

export type ReactionInput = Reaction;

// ---------------------------------------------------------------------------
// Interactive input (raw shape accepted by send)
// ---------------------------------------------------------------------------

export interface InteractiveInput {
  readonly action?: InteractiveActionInput;
  readonly body?: string;
  readonly footer?: string;
  readonly header?: InteractiveHeaderInput;
  readonly type: string;
}

export interface InteractiveHeaderInput {
  readonly document?: MediaInput;
  readonly image?: MediaInput;
  readonly text?: string;
  readonly type: string;
  readonly video?: MediaInput;
}

export interface InteractiveActionInput {
  readonly button?: string;
  readonly buttons?: readonly InteractiveButtonInput[];
  readonly catalogId?: string;
  readonly name?: string;
  readonly parameters?: InteractiveFlowParametersInput;
  readonly productRetailerId?: string;
  readonly sections?: readonly InteractiveSectionInput[];
}

export interface InteractiveButtonInput {
  readonly reply: { readonly id: string; readonly title: string };
  readonly type: string;
}

export interface InteractiveSectionInput {
  readonly productItems?: readonly { readonly productRetailerId: string }[];
  readonly rows?: readonly InteractiveSectionRowInput[];
  readonly title?: string;
}

export interface InteractiveSectionRowInput {
  readonly description?: string;
  readonly id: string;
  readonly title: string;
}

export interface InteractiveFlowParametersInput {
  readonly flowAction?: string;
  readonly flowActionPayloadJson?: string;
  readonly flowCta: string;
  readonly flowId: string;
  readonly flowMessageVersion: string;
  readonly flowToken: string;
}

// ---------------------------------------------------------------------------
// Template input
// ---------------------------------------------------------------------------

export interface TemplateInput {
  readonly components?: readonly TemplateComponentInput[];
  readonly languageCode: string;
  readonly name: string;
}

export interface TemplateComponentInput {
  readonly cards?: readonly TemplateCardInput[];
  readonly index?: number;
  readonly parameters?: readonly TemplateParameterInput[];
  readonly subType?: string;
  readonly type: string;
}

export interface TemplateCardInput {
  readonly cardIndex: number;
  readonly components: readonly TemplateComponentInput[];
}

export interface TemplateParameterInput {
  readonly actionJson?: string;
  readonly couponCode?: string;
  readonly document?: MediaInput;
  readonly image?: MediaInput;
  readonly location?: LocationInput;
  readonly payload?: string;
  readonly text?: string;
  readonly type: string;
  readonly video?: MediaInput;
}

// ---------------------------------------------------------------------------
// Contact card input (outbound)
// ---------------------------------------------------------------------------

export type ContactCardInput = ContactCard;

// ---------------------------------------------------------------------------
// Message content discriminated union
// ---------------------------------------------------------------------------

export type MessageContent =
  | { readonly text: string | TextInput }
  | { readonly image: MediaInput }
  | { readonly video: MediaInput }
  | { readonly audio: MediaInput }
  | { readonly document: MediaInput }
  | { readonly sticker: StickerInput }
  | { readonly location: LocationInput }
  | { readonly reaction: ReactionInput }
  | { readonly interactive: InteractiveInput }
  | { readonly template: TemplateInput }
  | { readonly contacts: readonly ContactCardInput[] };

// ---------------------------------------------------------------------------
// Send message params & result
// ---------------------------------------------------------------------------

export type SendMessageParams = {
  readonly to: string;
  readonly replyTo?: string;
  readonly bizOpaqueCallbackData?: string;
} & MessageContent;

export interface SendMessageResult {
  readonly messageId: string;
  readonly messageStatus: string;
}
