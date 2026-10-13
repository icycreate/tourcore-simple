import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parsers } from "prettier/plugins/typescript";
import {
  languages,
  messages,
  translate,
  formatDate,
  formatMoney,
} from "../lib/i18n.mjs";
test("Four complete catalogs preserve interpolation placeholders", () => {
  assert.deepEqual(
    languages.map((l) => l.value),
    ["en", "es", "zh-Hant", "zh-Hans"],
  );
  for (const { value } of languages) {
    assert.deepEqual(
      Object.keys(messages[value]).sort(),
      Object.keys(messages.en).sort(),
    );
    for (const [key, text] of Object.entries(messages[value])) {
      assert.ok(text.trim(), `${value}: ${key}`);
      assert.deepEqual(
        [...text.matchAll(/\{\w+\}/g)].map((m) => m[0]).sort(),
        [...key.matchAll(/\{\w+\}/g)].map((m) => m[0]).sort(),
        `${value}: ${key}`,
      );
    }
  }
  assert.equal(
    translate("es", "Move to {status}", { status: translate("es", "Ongoing") }),
    "Cambiar a En curso",
  );
  assert.equal(translate("zh-Hant", "Company Profile"), "公司資料");
  assert.equal(translate("zh-Hans", "Company Profile"), "公司资料");
});
test("Every static UI label has translations, including forms and accessibility labels", async () => {
  const required = new Set();
  for (const path of ["components/workspace.tsx", "components/settings.tsx"]) {
    const source = await readFile(
      new URL("../" + path, import.meta.url),
      "utf8",
    );
    const ast = parsers.typescript.parse(source, { filepath: path });
    function visit(node) {
      if (!node || typeof node !== "object") return;
      if (
        node.type === "CallExpression" &&
        ["tr", "t", "field", "sel", "input"].includes(node.callee?.name) &&
        node.arguments[0]?.type === "Literal" &&
        typeof node.arguments[0].value === "string"
      )
        required.add(node.arguments[0].value);
      if (node.type === "JSXText") {
        const text = node.value.replace(/\s+/g, " ").trim();
        if (
          /[A-Za-z]/.test(text) &&
          !["TourCore", "TourCore Simple", "◈ TourCore", "SIMPLE"].includes(
            text,
          )
        )
          assert.fail(`Unlocalized JSX in ${path}: ${text}`);
      }
      if (
        node.type === "JSXAttribute" &&
        ["aria-label", "placeholder", "alt", "title"].includes(
          node.name?.name,
        ) &&
        node.value?.type === "Literal"
      )
        assert.fail(`Unlocalized accessibility label: ${node.value.value}`);
      for (const [key, value] of Object.entries(node))
        if (key !== "parent") {
          if (Array.isArray(value)) value.forEach(visit);
          else if (value && typeof value === "object" && value.type)
            visit(value);
        }
    }
    visit(ast);
  }
  for (const key of required)
    for (const { value } of languages)
      assert.ok(messages[value][key], `Missing ${value} translation: ${key}`);
});
test("Locale formatting and user content remain distinct", () => {
  assert.match(formatMoney(12.5, "es"), /12,50/);
  assert.notEqual(
    formatDate("2026-10-12", "es"),
    formatDate("2026-10-12", "zh-Hant"),
  );
  assert.equal(translate("zh-Hans", "Forest Lodge"), "Forest Lodge");
});
