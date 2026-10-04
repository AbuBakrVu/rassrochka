// Оттенки из цвета компании (lib/brand-color.ts). Запуск: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BRAND_PRESETS,
  brandCss,
  brandWarning,
  contrast,
  darkShades,
  lightShades,
  normalizeHex,
} from "./brand-color.ts";

test("текст на кнопке читается у всех готовых цветов", () => {
  for (const p of BRAND_PRESETS) {
    const l = lightShades(p.hex);
    assert.ok(contrast(l.brand, l.onBrand) >= 4.2, `${p.name}: кнопка`);
    const d = darkShades(p.hex);
    assert.ok(contrast(d.brand, d.onBrand) >= 4.2, `${p.name}: кнопка в тёмной теме`);
    assert.ok(contrast(d.brand, "#111b21") >= 4, `${p.name}: виден на тёмном фоне`);
  }
});

test("светлый цвет получает тёмный текст и предупреждение", () => {
  assert.equal(lightShades("#facc15").onBrand, "#13202a");
  assert.ok(brandWarning("#facc15"));
  assert.equal(brandWarning("#1d5fd6"), null);
});

test("код цвета принимается с решёткой и без", () => {
  assert.equal(normalizeHex("1D5FD6"), "#1d5fd6");
  assert.equal(normalizeHex(" #1d5fd6 "), "#1d5fd6");
  assert.equal(normalizeHex("#zzz"), null);
  assert.equal(normalizeHex("red"), null);
});

test("стандартная тема — пустой стиль, свой цвет — переопределение переменных", () => {
  assert.equal(brandCss(null), "");
  assert.equal(brandCss("not-a-color"), "");
  const css = brandCss("#1d5fd6");
  assert.match(css, /--primary:#1d5fd6/);
  assert.match(css, /:root:root\.dark\{/);
  // Значение не выходит за пределы объявления — сюда не подсунуть CSS
  assert.doesNotMatch(brandCss("#1d5fd6;}body{display:none"), /display/);
});
