/**
 * Automated Verification Script for WordChain Refactored Architecture
 */
const fs = require('fs');
const path = require('path');

console.log("=== [1] Checking syntax of all files ===");
const files = [
  'wordchain/js/phonetics.js',
  'wordchain/js/personas.js',
  'wordchain/js/career.js',
  'wordchain/js/board.js',
  'wordchain/js/viewport.js',
  'wordchain/js/ai.js',
  'wordchain/js/victory.js',
  'wordchain/js/learned.js',
  'wordchain/js/zen_ambient.js',
  'wordchain/game.js'
];

files.forEach(f => {
  const code = fs.readFileSync(path.join(__dirname, '..', f), 'utf-8');
  new Function(code); // Throws if syntax is invalid
  console.log(`✓ ${f} syntax OK`);
});

console.log("\n=== [2] Testing Phonetics and Puns ===");
const Phonetics = require('../wordchain/js/phonetics.js');
console.log("Phonetics loaded:", Object.keys(Phonetics));

// Test exact match
const matchExact = Phonetics.checkPhoneticMatch("空", "空", true, true);
console.log("Exact match:", matchExact.match, matchExact.isExact, matchExact.desc);
if (!matchExact.match || !matchExact.isExact) throw new Error("Exact match failed");

// Test true pun
const punTest = Phonetics.checkTruePun("字戀狂");
console.log("True pun '字戀狂':", punTest);
if (!punTest || !punTest.isPun || punTest.original !== "自戀狂") throw new Error("Pun check failed");

const punTest2 = Phonetics.checkTruePun("無蟹可及");
console.log("True pun '無蟹可及':", punTest2);
if (!punTest2 || !punTest2.isPun || punTest2.original !== "無懈可擊") throw new Error("Pun check failed");

console.log("\n=== [3] Testing Personas & Dialogue ===");
const Personas = require('../wordchain/js/personas.js');
const banter = Personas.generateSituationalBanter("ji_xiaolan", "字戀狂", "天馬行空", "絕殺");
console.log("Generated Banter:", banter);
if (!banter || typeof banter !== 'string') throw new Error("Banter generation failed");

console.log("\n=== [4] Testing Career Divination ===");
const Career = require('../wordchain/js/career.js');
const careerResult = Career.divineCareer(["晶片", "半導體", "演算法", "除錯"]);
console.log("Career for tech words:", careerResult.tag, "|", careerResult.title);
if (!careerResult.title.includes("工程師") && !careerResult.tag.includes("科技")) {
  throw new Error("Career divination failed for tech keywords");
}

console.log("\n=== [5] Testing AI Scoring Logic (原字諧音 > 同音諧音哏 > 原字 > 同音) ===");
const AI = require('../wordchain/js/ai.js');

const combo1 = { exactCount: 0, exactCombo: 0, phoneticCount: 0, phoneticCombo: 0, truePunCount: 0, exactPunCount: 0, homophoneCount: 0, homophoneCombo: 0 };
const resExactPun = AI.calculatePlayerPoints({
  word: "字戀狂",
  isExact: true,
  isTruePun: true,
  punInfo: { original: "自戀狂" },
  elapsed: 2.0,
  tailScore: 5,
  comboState: combo1
});

const combo2 = { exactCount: 0, exactCombo: 0, phoneticCount: 0, phoneticCombo: 0, truePunCount: 0, exactPunCount: 0, homophoneCount: 0, homophoneCombo: 0 };
const resHomoPun = AI.calculatePlayerPoints({
  word: "字戀狂",
  isExact: false,
  isTruePun: true,
  punInfo: { original: "自戀狂" },
  elapsed: 2.0,
  tailScore: 5,
  comboState: combo2
});

const combo3 = { exactCount: 0, exactCombo: 0, phoneticCount: 0, phoneticCombo: 0, truePunCount: 0, exactPunCount: 0, homophoneCount: 0, homophoneCombo: 0 };
const resExact = AI.calculatePlayerPoints({
  word: "四庫全書",
  isExact: true,
  isTruePun: false,
  punInfo: null,
  elapsed: 2.0,
  tailScore: 5,
  comboState: combo3
});

const combo4 = { exactCount: 0, exactCombo: 0, phoneticCount: 0, phoneticCombo: 0, truePunCount: 0, exactPunCount: 0, homophoneCount: 0, homophoneCombo: 0 };
const resHomo = AI.calculatePlayerPoints({
  word: "四庫全書",
  isExact: false,
  isTruePun: false,
  punInfo: null,
  elapsed: 2.0,
  tailScore: 5,
  comboState: combo4
});

console.log(`Scores:
  1. 原字諧音: ${resExactPun.pts} pts, dmg: ${resExactPun.dmg}
  2. 同音諧音: ${resHomoPun.pts} pts, dmg: ${resHomoPun.dmg}
  3. 原字接龍: ${resExact.pts} pts, dmg: ${resExact.dmg}
  4. 同音接龍: ${resHomo.pts} pts, dmg: ${resHomo.dmg}
`);

if (!(resExactPun.pts > resHomoPun.pts && resHomoPun.pts > resExact.pts && resExact.pts > resHomo.pts)) {
  throw new Error("Scoring hierarchy assertion failed: Expected 原字諧音 > 同音諧音哏 > 原字 > 同音");
}
console.log("✓ Scoring hierarchy verified: 原字諧音 > 同音諧音哏 > 原字 > 同音 PERFECT!");

console.log("\n=== [6] Testing Small Terminal & Fullscreen Zen Specifications ===");
const assert = require('assert');
const Viewport = require('../wordchain/js/viewport.js');

// Test 6.1: Small terminal scale detection
global.window = { innerWidth: 390, innerHeight: 844 }; // iPhone 12/13/14
assert(Viewport.isSmallTerminal() === true, "Should identify iPhone as small terminal");
assert(Viewport.is4KDisplay() === false, "iPhone is not 4K");
assert(Viewport.getDefaultScale() === 0.95, "Small terminal default scale should be 0.95");

// Test 6.2: 4K scale detection
global.window = { innerWidth: 3840, innerHeight: 2160 };
assert(Viewport.is4KDisplay() === true, "Should identify 3840x2160 as 4K");
assert(Viewport.isSmallTerminal() === false, "4K is not small terminal");
assert(Viewport.getDefaultScale() === 1.5, "4K default scale should be 1.5");

// Test 6.3: Standard Desktop scale detection
global.window = { innerWidth: 1920, innerHeight: 1080 };
assert(Viewport.is4KDisplay() === false, "1080p is not 4K");
assert(Viewport.isSmallTerminal() === false, "1080p is not small terminal");
assert(Viewport.getDefaultScale() === 1.0, "Standard desktop scale should be 1.0");

console.log("✓ Viewport scale resolution verified across Mobile (0.95x), Desktop (1.0x), and 4K (1.5x)");

// Test 6.4: Check index.html and style.css for HUD labels and Fullscreen Zen
const indexHtml = fs.readFileSync('wordchain/index.html', 'utf8');
const styleCss = fs.readFileSync('wordchain/style.css', 'utf8');

assert(indexHtml.includes('btn-zen-exit'), "index.html must have btn-zen-exit button");
assert(indexHtml.includes('hud-label-full') && indexHtml.includes('hud-label-compact'), "index.html must have responsive hud-label spans");
assert(styleCss.includes('body.fullscreen-zen header') && styleCss.includes('body.fullscreen-zen .control-bar'), "style.css must hide chrome in fullscreen-zen");
assert(styleCss.includes('body.fullscreen-zen #tab-learned'), "style.css must isolate and hide #tab-learned in fullscreen-zen");
assert(styleCss.includes('.hud-label-compact'), "style.css must have .hud-label-compact rules");
assert(!styleCss.includes('.brand div div {'), "style.css must not hide brand div div");
assert(styleCss.includes('zen-cursor-hidden') && styleCss.includes('zen-cursor-fading'), "style.css must have zen-cursor-hidden and zen-cursor-fading rules");
assert(styleCss.includes('.zen-ambient-canvas'), "style.css must have .zen-ambient-canvas rules");
assert(indexHtml.includes('zen_ambient.js'), "index.html must include zen_ambient.js");
assert(indexHtml.includes('zen-ambient-canvas'), "index.html must include zen-ambient-canvas");

const ZenAmbient = require('../wordchain/js/zen_ambient.js');
assert(typeof ZenAmbient.start === 'function', "ZenAmbient must have start function");
assert(typeof ZenAmbient.stop === 'function', "ZenAmbient must have stop function");
assert(typeof ZenAmbient.isActive === 'function', "ZenAmbient must have isActive function");
assert(typeof ZenAmbient.setTargetFps === 'function', "ZenAmbient must have setTargetFps function");
assert(typeof ZenAmbient.getTargetFps === 'function', "ZenAmbient must have getTargetFps function");
assert(ZenAmbient.getTargetFps() === 60, "Default targetFps must be 60 FPS for frame capping");
ZenAmbient.setTargetFps(30);
assert(ZenAmbient.getTargetFps() === 30, "Target FPS must be updatable to 30");
assert(ZenAmbient.instance.frameInterval === 1000 / 30, "Frame interval must match 30 FPS");
ZenAmbient.setTargetFps(60);
assert(ZenAmbient.getTargetFps() === 60, "Target FPS reset to 60");

console.log("✓ Zen Ambient Background Engine, Frame Capping & Canvas rules verified!");

console.log("\n=== ALL ARCHITECTURE & RESPONSIVE TESTS PASSED! ===");

