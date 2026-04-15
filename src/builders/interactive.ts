import type {
  InteractiveFlowParametersInput,
  InteractiveHeaderInput,
  InteractiveInput,
  InteractiveSectionInput,
  InteractiveSectionRowInput,
} from "../types/messages.ts";

// ---------------------------------------------------------------------------
// Button helpers
// ---------------------------------------------------------------------------

export interface Button {
  readonly id: string;
  readonly title: string;
}

export function button(id: string, title: string): Button {
  return { id, title };
}

export function buttons(body: string, ...btns: Button[]): InteractiveInput {
  return {
    type: "button",
    body,
    action: {
      buttons: btns.map((b) => ({
        type: "reply",
        reply: { id: b.id, title: b.title },
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// List builder
// ---------------------------------------------------------------------------

export class ListBuilder implements InteractiveInput {
  readonly type = "list";
  readonly body: string;
  readonly footer?: string;
  readonly header?: InteractiveHeaderInput;
  readonly action: {
    readonly button: string;
    readonly sections: readonly InteractiveSectionInput[];
  };

  constructor(
    body: string,
    buttonText: string,
    sections: readonly InteractiveSectionInput[] = [],
    header?: InteractiveHeaderInput,
    footer?: string
  ) {
    this.body = body;
    this.header = header;
    this.footer = footer;
    this.action = { button: buttonText, sections };
  }

  section(
    title: string,
    rows: readonly InteractiveSectionRowInput[]
  ): ListBuilder {
    return new ListBuilder(
      this.body,
      this.action.button,
      [...this.action.sections, { title, rows }],
      this.header,
      this.footer
    );
  }

  withHeader(header: InteractiveHeaderInput): ListBuilder {
    return new ListBuilder(
      this.body,
      this.action.button,
      this.action.sections,
      header,
      this.footer
    );
  }

  withFooter(text: string): ListBuilder {
    return new ListBuilder(
      this.body,
      this.action.button,
      this.action.sections,
      this.header,
      text
    );
  }
}

export function list(body: string, buttonText: string): ListBuilder {
  return new ListBuilder(body, buttonText);
}

// ---------------------------------------------------------------------------
// Product helpers
// ---------------------------------------------------------------------------

export function product(
  catalogId: string,
  productRetailerId: string
): InteractiveInput {
  return {
    type: "product",
    action: { catalogId, productRetailerId },
  };
}

// ---------------------------------------------------------------------------
// Product list builder
// ---------------------------------------------------------------------------

export class ProductListBuilder implements InteractiveInput {
  readonly type = "product_list";
  readonly body?: string;
  readonly header?: InteractiveHeaderInput;
  readonly footer?: string;
  readonly action: {
    readonly catalogId: string;
    readonly sections: readonly InteractiveSectionInput[];
  };

  constructor(
    catalogId: string,
    headerText: string,
    sections: readonly InteractiveSectionInput[] = [],
    footer?: string
  ) {
    this.header = { type: "text", text: headerText };
    this.action = { catalogId, sections };
    this.footer = footer;
  }

  section(
    title: string,
    productRetailerIds: readonly string[]
  ): ProductListBuilder {
    return new ProductListBuilder(
      this.action.catalogId,
      this.header?.text ?? "",
      [
        ...this.action.sections,
        {
          title,
          productItems: productRetailerIds.map((id) => ({
            productRetailerId: id,
          })),
        },
      ],
      this.footer
    );
  }

  withFooter(text: string): ProductListBuilder {
    return new ProductListBuilder(
      this.action.catalogId,
      this.header?.text ?? "",
      this.action.sections,
      text
    );
  }
}

export function productList(
  catalogId: string,
  headerText: string
): ProductListBuilder {
  return new ProductListBuilder(catalogId, headerText);
}

// ---------------------------------------------------------------------------
// Flow helper
// ---------------------------------------------------------------------------

export interface FlowOptions {
  readonly body: string;
  readonly footer?: string;
  readonly header?: InteractiveHeaderInput;
  readonly parameters: InteractiveFlowParametersInput;
}

export function flow(options: FlowOptions): InteractiveInput {
  return {
    type: "flow",
    body: options.body,
    header: options.header,
    footer: options.footer,
    action: {
      name: "flow",
      parameters: options.parameters,
    },
  };
}
