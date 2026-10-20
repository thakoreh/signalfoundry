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
  for (const destination of [
    "#main-content",
    "#workflow",
    "#your-list",
    "#faq",
  ])
    assert.ok(sectionLinks.includes(destination), destination);
});

test("illustrative preview is a static server component without data or mutation dependencies", () => {
  const parsed = parse(demo);
  const dependencies = parsed.statements.filter(ts.isImportDeclaration);
  assert.equal(dependencies.length, 1);
  assert.equal(dependencies[0].moduleSpecifier.getText(), '"./icons"');
  assert.doesNotMatch(
    demo,
    /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage|indexedDB|setInterval|setTimeout)\b/,
  );
  assert.doesNotMatch(demo, /\b(?:import|require)\s*\(/);
  assert.doesNotMatch(demo, /^\s*["']use client["'];/);
});
