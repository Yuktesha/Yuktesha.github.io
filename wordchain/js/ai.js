/**
 * 字戀 (WordChain) - [第六章] 詞庫檢索與 AI 決策智囊 (AI Strategy & Hint Engine)
 * 職責：
 * 1. 典雅詞庫篩選與加權排序演算法 (成語、典故、詩詞長句加權、粵語俗字過濾)
 * 2. AI 對手出招決策樹 (難度調控：寬宏、旗鼓、絕殺；學以致用反擊)
 * 3. 戰鬥積分與氣血傷害公式 (文采化劍氣：原字諧音 > 同音諧音哏 > 原字 > 同音)
 * 4. 軍師錦囊智慧獻策 (首選、次選、變招、奇兵)
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WordChain = root.WordChain || {};
    root.WordChain.AI = factory();
    Object.assign(root, root.WordChain.AI);
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ==========================================
  // 1. 詞庫查詢與高雅典故加權排序 (getScoredEntries)
  // ==========================================
  function getScoredEntries(lexicon, tailChar, options = {}) {
    if (!lexicon || !tailChar) return [];

    const {
      allowHomo = true,
      strictTone = true,
      usedWords = new Set(),
      currentWord = ""
    } = options;

    const P = (typeof window !== 'undefined' && window.WordChain && window.WordChain.Phonetics) || {};
    const getTailZhFn = P.getWordTailZhuyin || (() => "");
    const getCharZhFn = P.getCharZhuyin || (() => "");
    const getAllReadingsFn = P.getCharAllReadings || (() => []);
    const getBaseZhFn = P.getBaseZhuyin || (s => s ? s.replace(/[ˊˇˋ˙]/g, "") : "");
    const parseToneFn = P.parseZhuyinTone || (() => 1);
    const getHeadZhFn = P.getWordHeadZhuyin || (() => "");

    let entries = [...((lexicon[tailChar] && lexicon[tailChar].w) || [])];

    if (allowHomo) {
      const actualTargetZh = currentWord ? getTailZhFn(currentWord) : getCharZhFn(tailChar);
      const targetBases = actualTargetZh ? [getBaseZhFn(actualTargetZh)] : getAllReadingsFn(tailChar).map(r => getBaseZhFn(r[0]));
      const targetTones = actualTargetZh ? [parseToneFn(actualTargetZh)] : getAllReadingsFn(tailChar).map(r => parseToneFn(r[0]));

      for (const [hc, data] of Object.entries(lexicon)) {
        if (hc === tailChar || !data.w) continue;

        const headReadings = getAllReadingsFn(hc);
        let charMayMatch = false;
        for (const [hZh] of headReadings) {
          const hb = getBaseZhFn(hZh);
          const ht = parseToneFn(hZh);
          for (let i = 0; i < targetBases.length; i++) {
            if (hb === targetBases[i] && (!strictTone || ht === targetTones[i])) {
              charMayMatch = true;
              break;
            }
          }
          if (charMayMatch) break;
        }
        if (!charMayMatch) continue;

        for (const wordEntry of data.w) {
          const candWord = wordEntry[0];
          const candHeadZh = getHeadZhFn(candWord);
          const hBase = getBaseZhFn(candHeadZh);
          const hTone = parseToneFn(candHeadZh);

          let matched = false;
          for (let i = 0; i < targetBases.length; i++) {
            if (hBase === targetBases[i]) {
              if (!strictTone || hTone === targetTones[i]) {
                matched = true;
                break;
              } else {
                const hasExplicit = typeof window !== 'undefined' && window.WORD_OVERRIDES && window.WORD_OVERRIDES[candWord] && window.WORD_OVERRIDES[candWord].h;
                if (!hasExplicit) {
                  for (const [rZh] of headReadings) {
                    if (getBaseZhFn(rZh) === targetBases[i] && parseToneFn(rZh) === targetTones[i]) {
                      matched = true;
                      break;
                    }
                  }
                  if (matched) break;
                }
              }
            }
          }
          if (matched) {
            entries.push(wordEntry);
          }
        }
      }
    }

    // 1. 去除已使用的詞
    entries = entries.filter(e => !usedWords.has(e[0]));

    // 2. 嚴格過濾低質詞彙：排除粵語口語俗字、機械翻譯與「的」字句
    const slangChars = new Set(['乜', '嘢', '喐', '嘅', '啲', '咗', '唔', '喺', '嬲', '哋']);
    entries = entries.filter(e => {
      const w = e[0];
      if (!w || w.length < 2) return false;
      if (w.includes('的')) return false;
      for (const c of w) {
        if (slangChars.has(c)) return false;
      }
      return true;
    });

    // 3. 高雅典故與四字成語加權排序 (Classical Literary Scoring)
    entries.sort((a, b) => {
      const wa = a[0];
      const wb = b[0];
      let scoreA = 0;
      let scoreB = 0;

      if (typeof window !== 'undefined' && window.STORY_CACHE) {
        if (window.STORY_CACHE[wa]) scoreA += 10000;
        if (window.STORY_CACHE[wb]) scoreB += 10000;
      }

      scoreA += (a[3] || 100) * 5;
      scoreB += (b[3] || 100) * 5;

      if (wa.length >= 4 && typeof window !== 'undefined' && window.STORY_CACHE && window.STORY_CACHE[wa]) scoreA += 3500;
      else if (wa.length === 4) scoreA += 3000;

      if (wb.length >= 4 && typeof window !== 'undefined' && window.STORY_CACHE && window.STORY_CACHE[wb]) scoreB += 3500;
      else if (wb.length === 4) scoreB += 3000;

      scoreA += Math.min(a[2] || 0, 40) * 10;
      scoreB += Math.min(b[2] || 0, 40) * 10;

      return scoreB - scoreA;
    });

    return entries;
  }

  // ==========================================
  // 2. AI 出招決策演算法 (selectAIMove)
  // ==========================================
  function selectAIMove(entries, difficulty = "normal", learnedWords = {}) {
    if (!entries || entries.length === 0) return null;

    let chosenEntry = null;
    let strategy = "旗鼓相當";

    // 1. 優先打出玩家教導詞（學以致用）
    const learnedKeys = Object.keys(learnedWords);
    for (const lk of learnedKeys) {
      const match = entries.find(e => e[0] === lk);
      if (match) {
        chosenEntry = match;
        strategy = "學以致用：原物奉還！";
        return { entry: chosenEntry, strategy };
      }
    }

    // 2. 難度調控
    if (difficulty === "easy") {
      const easyPool = entries.filter(e => e[2] >= 15);
      chosenEntry = easyPool.length ? easyPool[Math.floor(Math.random() * easyPool.length)] : entries[0];
      strategy = `寬大為懷：留有 ${chosenEntry[2]} 步生路`;
    } else if (difficulty === "hard") {
      const killPool = entries.filter(e => e[2] === 0);
      if (killPool.length) {
        chosenEntry = killPool[Math.floor(Math.random() * killPool.length)];
        strategy = "💀地獄絕殺：一擊必殺！";
      } else {
        const sorted = [...entries].sort((a, b) => a[2] - b[2]);
        chosenEntry = sorted[0];
        strategy = `地獄壓迫：對手僅剩 ${chosenEntry[2]} 步生路`;
      }
    } else {
      const normalPool = entries.filter(e => e[2] >= 4 && e[2] <= 20);
      chosenEntry = normalPool.length ? normalPool[Math.floor(Math.random() * normalPool.length)] : entries[0];
      strategy = `攻守兼備：留有 ${chosenEntry[2]} 條活路`;
    }

    return { entry: chosenEntry, strategy };
  }

  // ==========================================
  // 3. 玩家出招計分與傷害公式 (calculatePlayerPoints)
  // 階層：原字諧音 > 同音諧音哏 > 原字 > 同音
  // ==========================================
  function calculatePlayerPoints(params) {
    const {
      word,
      isExact,
      isTruePun,
      punInfo,
      elapsed,
      tailScore,
      comboState
    } = params;

    let pts = 100;
    let bonusPts = 0;
    let category = "homo";
    const isHomoMove = !isExact;

    if (isExact && isTruePun) {
      // 👑🤣 1. 原字諧音（最高境界）
      comboState.exactPunCount++;
      comboState.truePunCount++;
      comboState.exactCombo++;
      comboState.phoneticCombo = 0;
      comboState.homophoneCombo = 0;
      bonusPts = 260 + Math.min((comboState.exactCombo - 1) * 15, 60);
      pts += bonusPts;
      category = "exact_pun";
    } else if (isHomoMove && isTruePun) {
      // 🤣 2. 同音諧音哏（次高）
      comboState.truePunCount++;
      comboState.phoneticCombo++;
      comboState.homophoneCombo = comboState.phoneticCombo;
      comboState.exactCombo = 0;
      bonusPts = 200 + Math.min((comboState.phoneticCombo - 1) * 10, 40);
      pts += bonusPts;
      category = "homo_pun";
    } else if (isExact) {
      // 👑 3. 原字接龍（同字直咬）
      comboState.exactCount++;
      comboState.exactCombo++;
      comboState.phoneticCombo = 0;
      comboState.homophoneCombo = 0;
      bonusPts = 100 + Math.min((comboState.exactCombo - 1) * 15, 60);
      pts += bonusPts;
      category = "exact";
    } else {
      // 🎵 4. 普通同音字接龍
      comboState.phoneticCount++;
      comboState.phoneticCombo++;
      comboState.homophoneCount = comboState.phoneticCount;
      comboState.homophoneCombo = comboState.phoneticCombo;
      comboState.exactCombo = 0;
      bonusPts = 50 + Math.min((comboState.phoneticCombo - 1) * 5, 20);
      pts += bonusPts;
      category = "homo";
    }

    // 長詞獎勵
    let lenDesc = `${word.length}字詞格`;
    if (word.length >= 8) {
      pts += 120;
      lenDesc = `🌟 ${word.length}字宏篇`;
    } else if (word.length === 7) {
      pts += 90;
      lenDesc = `👑 七言絕句`;
    } else if (word.length === 6) {
      pts += 60;
      lenDesc = `📜 六言名句`;
    } else if (word.length === 5) {
      pts += 50;
      lenDesc = `📜 五言名句`;
    } else if (word.length === 4) {
      pts += 25;
      lenDesc = `四字成語`;
    }

    // 速度獎勵
    if (elapsed < 3.0) pts += 30;
    else if (elapsed <= 8.0) pts += 15;
    else if (elapsed > 20.0) pts -= 10;

    // 出度雷達加分
    if (tailScore === 0) pts += 100;
    else if (tailScore <= 3) pts += 40;
    else if (tailScore <= 8) pts += 15;

    // 文采化劍氣：出招傷害直接與文采得分掛鉤 (基礎 15 + 得分 * 0.3)
    const dmg = Math.max(20, Math.round(15 + pts * 0.3));

    return {
      pts,
      dmg,
      bonusPts,
      category,
      lenDesc
    };
  }

  // ==========================================
  // 4. AI 評分與傷害公式
  // ==========================================
  function calculateAIPoints(chosenWord, isExact, aiTailScore) {
    let aiPts = 80;
    if (isExact) aiPts += 40;
    else aiPts += 20;

    if (chosenWord.length >= 6) aiPts += 40;
    else if (chosenWord.length >= 5) aiPts += 30;
    else if (chosenWord.length === 4) aiPts += 15;

    if (aiTailScore === 0) aiPts += 80;
    else if (aiTailScore <= 3) aiPts += 35;
    else if (aiTailScore <= 8) aiPts += 15;

    const aiDmg = Math.max(15, Math.round(15 + aiPts * 0.25));
    return { aiPts, aiDmg };
  }

  return {
    getScoredEntries,
    selectAIMove,
    calculatePlayerPoints,
    calculateAIPoints
  };
});
