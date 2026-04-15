import { describe, expect, it } from "bun:test";
import {
  actionJson,
  couponCode,
  document,
  image,
  location,
  payload,
  template,
  text,
  video,
} from "../../src/builders/template.ts";

describe("template builder", () => {
  it("creates a basic template", () => {
    const t = template("hello_world", "en_US");
    expect(t.name).toBe("hello_world");
    expect(t.languageCode).toBe("en_US");
    expect(t.components).toEqual([]);
  });

  it("adds header component", () => {
    const t = template("order", "en").header(
      image({ link: "https://img.com/photo.jpg" })
    );
    expect(t.components.length).toBe(1);
    expect(t.components[0]?.type).toBe("header");
    expect(t.components[0]?.parameters?.[0]?.type).toBe("image");
  });

  it("adds body component with text params", () => {
    const t = template("order", "en").body(text("John"), text("Order #123"));
    expect(t.components.length).toBe(1);
    expect(t.components[0]?.parameters?.length).toBe(2);
    expect(t.components[0]?.parameters?.[0]?.text).toBe("John");
    expect(t.components[0]?.parameters?.[1]?.text).toBe("Order #123");
  });

  it("adds button component", () => {
    const t = template("confirm", "en").button(0, payload("CONFIRM"));
    expect(t.components[0]?.type).toBe("button");
    expect(t.components[0]?.subType).toBe("quick_reply");
    expect(t.components[0]?.index).toBe(0);
  });

  it("adds url button component", () => {
    const t = template("track", "en").urlButton(
      0,
      text("https://track.com/123")
    );
    expect(t.components[0]?.subType).toBe("url");
  });

  it("chains header + body + button immutably", () => {
    const base = template("order", "en");
    const full = base
      .header(image({ link: "https://img.com/photo.jpg" }))
      .body(text("John"))
      .button(0, payload("CONFIRM"));

    // Original is unchanged
    expect(base.components.length).toBe(0);
    // Chained has all three
    expect(full.components.length).toBe(3);
  });

  it("implements TemplateInput interface (name, languageCode, components)", () => {
    const t = template("test", "en").body(text("x"));
    // Should be usable directly as TemplateInput
    expect(t.name).toBe("test");
    expect(t.languageCode).toBe("en");
    expect(Array.isArray(t.components)).toBe(true);
  });

  it("supports all parameter factory functions", () => {
    expect(text("hello").type).toBe("text");
    expect(image({ link: "x" }).type).toBe("image");
    expect(video({ link: "x" }).type).toBe("video");
    expect(document({ id: "x" }).type).toBe("document");
    expect(location({ latitude: 0, longitude: 0 }).type).toBe("location");
    expect(payload("x").type).toBe("payload");
    expect(couponCode("x").type).toBe("coupon_code");
    expect(actionJson("{}").type).toBe("action");
  });
});
