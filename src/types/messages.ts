import type {
  ContactCard,
  Location,
  Reaction,
} from "./common.ts";

// ---------------------------------------------------------------------------
// Outbound content sub-types
// ---------------------------------------------------------------------------

export interface TextInput {
  readonly body: string;
  readonly previewUrl?: boolean;
}

export interface MediaInput {
  readonly id?: string;
  readonly link?: string;
  readonly caption?: string;
  readonly filename?: string;
  readonly mimeType?: string;
}

export type StickerInput = Pick<MediaInput, "id" | "link">;

export type LocationInput = Location;

export type ReactionInput = Reaction;

// ---------------------------------------------------------------------------
// Interactive input (raw shape accepted by send)
// ---------------------------------------------------------------------------

export interface InteractiveInput {
  readonly type: string;
  readonly header?: InteractiveHeaderInput;
  readonly body?: string;
  readonly footer?: string;
  readonly action?: InteractiveActionInput;
}

export interface InteractiveHeaderInput {
  readonly type: string;
  readonly text?: string;
  readonly image?: MediaInput;
  readonly video?: MediaInput;
  readonly document?: MediaInput;
}

export interface InteractiveActionInput {
  readonly buttons?: readonly InteractiveButtonInput[];
  readonly button?: string;
  readonly sections?: readonly InteractiveSectionInput[];
  readonly catalogId?: string;
  readonly productRetailerId?: string;
  readonly name?: string;
  readonly parameters?: InteractiveFlowParametersInput;
}

export interface InteractiveButtonInput {
  readonly type: string;
  readonly reply: { readonly id: string; readonly title: string };
}

export interface InteractiveSectionInput {
  readonly title?: string;
  readonly rows?: readonly InteractiveSectionRowInput[];
  readonly productItems?: readonly { readonly productRetailerId: string }[];
}

export interface InteractiveSectionRowInput {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
}

export interface InteractiveFlowParametersInput {
  readonly flowMessageVersion: string;
  readonly flowToken: string;
  readonly flowId: string;
  readonly flowCta: string;
  readonly flowAction?: string;
  readonly flowActionPayloadJson?: string;
}

// ---------------------------------------------------------------------------
// Template input
// ---------------------------------------------------------------------------

export interface TemplateInput {
  readonly name: string;
  readonly languageCode: string;
  readonly components?: readonly TemplateComponentInput[];
}

export interface TemplateComponentInput {
  readonly type: string;
  readonly parameters?: readonly TemplateParameterInput[];
  readonly subType?: string;
  readonly index?: number;
  readonly cards?: readonly TemplateCardInput[];
}

export interface TemplateCardInput {
  readonly cardIndex: number;
  readonly components: readonly TemplateComponentInput[];
}

export interface TemplateParameterInput {
  readonly type: string;
  readonly text?: string;
  readonly image?: MediaInput;
  readonly video?: MediaInput;
  readonly document?: MediaInput;
  readonly location?: LocationInput;
  readonly payload?: string;
  readonly couponCode?: string;
  readonly actionJson?: string;
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
