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

console.log("\n=== ALL ARCHITECTURE TESTS PASSED! ===");
