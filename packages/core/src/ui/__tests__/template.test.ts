import { describe, it, expect } from "vitest";
import { renderTemplate, escapeHtml } from "../template";

describe("escapeHtml", () => {
  it("escapes the characters that could break out of text or an attribute", () => {
    expect(escapeHtml(`<b>&"'`)).toBe("&lt;b&gt;&amp;&quot;&#39;");
  });

  it("renders null/undefined as empty", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });

  it("stringifies numbers and booleans", () => {
    expect(escapeHtml(0)).toBe("0");
    expect(escapeHtml(false)).toBe("false");
  });
});

describe("renderTemplate — interpolation", () => {
  it("substitutes a top-level value", () => {
    expect(renderTemplate("<h3>{{title}}</h3>", { title: "Order" })).toBe("<h3>Order</h3>");
  });

  it("walks a dotted path", () => {
    expect(renderTemplate("{{user.name}}", { user: { name: "Hamza" } })).toBe("Hamza");
  });

  it("tolerates whitespace inside the tag", () => {
    expect(renderTemplate("{{  title  }}", { title: "x" })).toBe("x");
  });

  it("renders an unknown path as empty", () => {
    expect(renderTemplate("[{{nope.deep}}]", { title: "x" })).toBe("[]");
  });

  it("escapes interpolated values — a prop cannot inject markup", () => {
    const out = renderTemplate("<p>{{text}}</p>", { text: "<script>alert(1)</script>" });
    expect(out).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
  });

  it("escapes quotes so an attribute cannot be broken out of", () => {
    const out = renderTemplate(`<a title="{{t}}">x</a>`, { t: `" onmouseover="alert(1)` });
    expect(out).not.toContain(`onmouseover="`);
    expect(out).toContain("&quot;");
  });
});

describe("renderTemplate — #if", () => {
  it("renders the body when truthy", () => {
    expect(renderTemplate("{{#if ok}}yes{{/if}}", { ok: true })).toBe("yes");
  });

  it("skips the body when falsy", () => {
    expect(renderTemplate("{{#if ok}}yes{{/if}}", { ok: false })).toBe("");
    expect(renderTemplate("{{#if ok}}yes{{/if}}", { ok: "" })).toBe("");
    expect(renderTemplate("{{#if ok}}yes{{/if}}", {})).toBe("");
  });

  it("treats an empty array as falsy", () => {
    expect(renderTemplate("{{#if items}}has{{/if}}", { items: [] })).toBe("");
    expect(renderTemplate("{{#if items}}has{{/if}}", { items: [1] })).toBe("has");
  });

  it("supports else", () => {
    const tpl = "{{#if ok}}yes{{else}}no{{/if}}";
    expect(renderTemplate(tpl, { ok: true })).toBe("yes");
    expect(renderTemplate(tpl, { ok: false })).toBe("no");
  });

  it("nests", () => {
    const tpl = "{{#if a}}A{{#if b}}B{{/if}}{{/if}}";
    expect(renderTemplate(tpl, { a: true, b: true })).toBe("AB");
    expect(renderTemplate(tpl, { a: true, b: false })).toBe("A");
    expect(renderTemplate(tpl, { a: false, b: true })).toBe("");
  });
});

describe("renderTemplate — #each", () => {
  it("iterates primitives with {{this}}", () => {
    expect(renderTemplate("{{#each xs}}[{{this}}]{{/each}}", { xs: ["a", "b"] })).toBe("[a][b]");
  });

  it("iterates objects with field access", () => {
    const out = renderTemplate("{{#each rows}}<p>{{this.label}}:{{price}}</p>{{/each}}", {
      rows: [{ label: "Tea", price: 20 }, { label: "Cake", price: 35 }],
    });
    expect(out).toBe("<p>Tea:20</p><p>Cake:35</p>");
  });

  it("exposes @index", () => {
    expect(renderTemplate("{{#each xs}}{{@index}}{{/each}}", { xs: ["a", "b", "c"] })).toBe("012");
  });

  it("can still see the parent scope", () => {
    const out = renderTemplate("{{#each xs}}{{currency}}{{this}} {{/each}}", {
      currency: "₺",
      xs: [10, 20],
    });
    expect(out).toBe("₺10 ₺20 ");
  });

  it("renders nothing when the value is not an array", () => {
    expect(renderTemplate("{{#each xs}}x{{/each}}", { xs: "nope" })).toBe("");
    expect(renderTemplate("{{#each xs}}x{{/each}}", {})).toBe("");
  });

  it("nests inside #if", () => {
    const tpl = "{{#if rows}}<ul>{{#each rows}}<li>{{this}}</li>{{/each}}</ul>{{else}}empty{{/if}}";
    expect(renderTemplate(tpl, { rows: ["a"] })).toBe("<ul><li>a</li></ul>");
    expect(renderTemplate(tpl, { rows: [] })).toBe("empty");
  });
});

describe("renderTemplate — robustness", () => {
  it("never throws on an unbalanced block", () => {
    expect(() => renderTemplate("{{#if a}}open", { a: true })).not.toThrow();
    expect(renderTemplate("{{#if a}}open", { a: true })).toBe("open");
  });

  it("ignores a stray closing tag", () => {
    expect(renderTemplate("a{{/if}}b", {})).toBe("ab");
  });

  it("keeps an unknown block keyword visible instead of swallowing it", () => {
    expect(renderTemplate("{{#wat x}}body{{/wat}}", {})).toContain("{{#wat x}}");
  });

  it("returns an empty string for an empty template", () => {
    expect(renderTemplate("", { a: 1 })).toBe("");
  });

  it("leaves markup without tags untouched", () => {
    expect(renderTemplate("<p>plain</p>", {})).toBe("<p>plain</p>");
  });
});
