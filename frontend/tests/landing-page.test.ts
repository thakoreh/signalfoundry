import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const landing = readFileSync(
  new URL("../components/landing-page.tsx", import.meta.url),
  "utf8",
);
const demo = readFileSync(
  new URL("../components/landing-demo.tsx", import.meta.url),
  "utf8",
);

function parse(source: string) {
  return ts.createSourceFile(
    "component.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

function visit(node: ts.Node, check: (node: ts.Node) => void) {
  check(node);
  ts.forEachChild(node, (child) => visit(child, check));
}

test("public section navigation uses native anchors instead of Next route navigation", () => {
  const sectionLinks: string[] = [];
  visit(parse(landing), (node) => {
    if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node))
      return;
    for (const prop of node.attributes.properties) {
      if (!ts.isJsxAttribute(prop) || prop.name.getText() !== "href") continue;
      if (!prop.initializer || !ts.isStringLiteral(prop.initializer)) continue;
      if (!prop.initializer.text.startsWith("#")) continue;
      sectionLinks.push(prop.initializer.text);
      assert.equal(node.tagName.getText(), "a", prop.initializer.text);
    }
  });
  for (const destination of ["#workflow", "#examples", "#plans", "#faq"]) {
    assert.ok(sectionLinks.includes(destination), destination);
  }
});

test("sample walkthrough stays client-local with no backend or persistent storage", () => {
  const parsed = parse(demo);
  assert.match(demo, /^\s*["']use client["'];/);
  const imports = parsed.statements.filter(ts.isImportDeclaration);
  assert.ok(imports.length > 0);
  for (const statement of imports) {
    assert.ok(ts.isStringLiteral(statement.moduleSpecifier));
    assert.ok(
      ["react", "./landing-motion-provider"].includes(
        statement.moduleSpecifier.text,
      ),
      `Unexpected demo dependency: ${statement.moduleSpecifier.text}`,
    );
  }
  assert.doesNotMatch(
    demo,
    /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage|indexedDB)\b/,
  );
  assert.doesNotMatch(demo, /\b(?:import|require)\s*\(/);
});
