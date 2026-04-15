import type {
  LocationInput,
  MediaInput,
  TemplateComponentInput,
  TemplateInput,
  TemplateParameterInput,
} from "../types/messages.ts";

// ---------------------------------------------------------------------------
// Parameter factory functions
// ---------------------------------------------------------------------------

export type TemplateParam = TemplateParameterInput;

export function text(value: string): TemplateParam {
  return { type: "text", text: value };
}

export function image(media: MediaInput): TemplateParam {
  return { type: "image", image: media };
}

export function video(media: MediaInput): TemplateParam {
  return { type: "video", video: media };
}

export function document(media: MediaInput): TemplateParam {
  return { type: "document", document: media };
}

export function location(loc: LocationInput): TemplateParam {
  return { type: "location", location: loc };
}

export function payload(value: string): TemplateParam {
  return { type: "payload", payload: value };
}

export function couponCode(value: string): TemplateParam {
  return { type: "coupon_code", couponCode: value };
}

export function actionJson(value: string): TemplateParam {
  return { type: "action", actionJson: value };
}

// ---------------------------------------------------------------------------
// Carousel card helper
// ---------------------------------------------------------------------------

export interface CarouselCard {
  readonly cardIndex: number;
  readonly components: readonly TemplateComponentInput[];
}

// ---------------------------------------------------------------------------
// Template builder
// ---------------------------------------------------------------------------

export class TemplateBuilder implements TemplateInput {
  readonly name: string;
  readonly languageCode: string;
  readonly components: readonly TemplateComponentInput[];

  constructor(
    name: string,
    languageCode: string,
    components: readonly TemplateComponentInput[] = [],
  ) {
    this.name = name;
    this.languageCode = languageCode;
    this.components = components;
  }

  header(...params: TemplateParam[]): TemplateBuilder {
    return new TemplateBuilder(this.name, this.languageCode, [
      ...this.components,
      { type: "header", parameters: params },
    ]);
  }

  body(...params: TemplateParam[]): TemplateBuilder {
    return new TemplateBuilder(this.name, this.languageCode, [
      ...this.components,
      { type: "body", parameters: params },
    ]);
  }

  button(index: number, ...params: TemplateParam[]): TemplateBuilder {
    return new TemplateBuilder(this.name, this.languageCode, [
      ...this.components,
      { type: "button", subType: "quick_reply", index, parameters: params },
    ]);
  }

  urlButton(index: number, ...params: TemplateParam[]): TemplateBuilder {
    return new TemplateBuilder(this.name, this.languageCode, [
      ...this.components,
      { type: "button", subType: "url", index, parameters: params },
    ]);
  }

  carousel(cards: readonly CarouselCard[]): TemplateBuilder {
    return new TemplateBuilder(this.name, this.languageCode, [
      ...this.components,
      {
        type: "carousel",
        cards: cards.map((c) => ({
          cardIndex: c.cardIndex,
          components: [...c.components],
        })),
      },
    ]);
  }
}

export function template(
  name: string,
  languageCode: string,
): TemplateBuilder {
  return new TemplateBuilder(name, languageCode);
}
