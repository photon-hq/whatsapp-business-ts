import { describe, expect, it } from "bun:test";
import {
  button,
  buttons,
  flow,
  list,
  product,
  productList,
} from "../../src/builders/interactive.ts";

describe("buttons builder", () => {
  it("creates a button interactive message", () => {
    const msg = buttons(
      "Choose one",
      button("a", "Option A"),
      button("b", "Option B")
    );
    expect(msg.type).toBe("button");
    expect(msg.body).toBe("Choose one");
    expect(msg.action?.buttons?.length).toBe(2);
    expect(msg.action?.buttons?.[0]?.reply.id).toBe("a");
    expect(msg.action?.buttons?.[0]?.reply.title).toBe("Option A");
  });
});

describe("list builder", () => {
  it("creates a list with sections", () => {
    const msg = list("Browse menu", "View Menu")
      .section("Food", [
        { id: "pizza", title: "Pizza", description: "$12.99" },
        { id: "burger", title: "Burger" },
      ])
      .section("Drinks", [{ id: "cola", title: "Cola" }]);

    expect(msg.type).toBe("list");
    expect(msg.body).toBe("Browse menu");
    expect(msg.action.button).toBe("View Menu");
    expect(msg.action.sections.length).toBe(2);
    expect(msg.action.sections[0]?.title).toBe("Food");
    expect(msg.action.sections[0]?.rows?.length).toBe(2);
  });

  it("is immutable", () => {
    const base = list("Body", "Button");
    const withSection = base.section("S1", [{ id: "1", title: "One" }]);
    expect(base.action.sections.length).toBe(0);
    expect(withSection.action.sections.length).toBe(1);
  });

  it("supports footer", () => {
    const msg = list("Body", "Button").withFooter("Powered by WhatsApp");
    expect(msg.footer).toBe("Powered by WhatsApp");
  });
});

describe("product builder", () => {
  it("creates a single product message", () => {
    const msg = product("catalog1", "product1");
    expect(msg.type).toBe("product");
    expect(msg.action?.catalogId).toBe("catalog1");
    expect(msg.action?.productRetailerId).toBe("product1");
  });
});

describe("productList builder", () => {
  it("creates a product list with sections", () => {
    const msg = productList("catalog1", "Our Products")
      .section("Electronics", ["laptop1", "phone1"])
      .section("Accessories", ["case1"]);

    expect(msg.type).toBe("product_list");
    expect(msg.action.catalogId).toBe("catalog1");
    expect(msg.action.sections.length).toBe(2);
    expect(msg.action.sections[0]?.productItems?.length).toBe(2);
  });
});

describe("flow builder", () => {
  it("creates a flow message", () => {
    const msg = flow({
      body: "Complete the form",
      parameters: {
        flowMessageVersion: "3",
        flowToken: "token123",
        flowId: "flow123",
        flowCta: "Open Form",
      },
    });
    expect(msg.type).toBe("flow");
    expect(msg.body).toBe("Complete the form");
    expect(msg.action?.parameters?.flowId).toBe("flow123");
  });
});
