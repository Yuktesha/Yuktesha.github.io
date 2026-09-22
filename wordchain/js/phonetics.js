/**
 * 字戀 (WordChain) - [第一章] 漢字音韻與注音聲調解析系統 (Phonetics & Puns Engine)
 * 職責：
 * 1. 漢字注音、多音破音字庫、拼音轉換與聲調解析
 * 2. 嚴格同調、同音通押與同字直咬的語境比對
 * 3. 臺灣特有諧音雙關梗庫 (True Pun Detection) 與 CJK 字元清理
 * 4. 全域非侵入式 Toast 通知系統
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WordChain = root.WordChain || {};
    root.WordChain.Phonetics = factory();
    // 全域向下相容注入，確保任何 legacy 程式碼直接調用零報錯
    Object.assign(root, root.WordChain.Phonetics);
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ==========================================
  // 1. 全域非侵入式 Toast 提示 (100% 杜絕彈跳視窗與 IME 跑位)
  // ==========================================
  function showToast(message, type = "info", duration = 3500) {
    if (typeof document === 'undefined') return;
    const container = document.getElementById("toast-container");
    if (!container) return;

    const item = document.createElement("div");
    item.className = `toast-item ${type}`;

    let icon = "ℹ️";
    if (type === "success") icon = "🎉";
    else if (type === "warning") icon = "⚠️";
    else if (type === "error") icon = "❌";

    item.innerHTML = `<span style="margin-right:8px; font-size:1.1rem;">${icon}</span><span>${message}</span>`;
    container.appendChild(item);

    setTimeout(() => {
      item.style.opacity = "0";
      item.style.transform = "translateX(20px)";
      item.style.transition = "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
      setTimeout(() => {
        if (item.parentNode) item.parentNode.removeChild(item);
      }, 300);
    }, duration);
  }

  // ==========================================
  // 2. 基礎字元處理 (CJK Extract & Clean)
  // ==========================================
  function extractCJKChars(text) {
    if (!text) return [];
    return text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || [];
  }

  function getHeadChar(text) {
    const chars = extractCJKChars(text);
    if (chars.length > 0) return chars[0];
    const s = (text || "").trim();
    return s.length > 0 ? s[0] : "";
  }

  function getTailChar(text) {
    const chars = extractCJKChars(text);
    if (chars.length > 0) return chars[chars.length - 1];
    const s = (text || "").trim();
    return s.length > 0 ? s.slice(-1) : "";
  }

  function cleanInputWord(text) {
    if (!text) return "";
    const re = /[\s\u3000。，！？、；：…—～~·「」『』《》〈〉（）()\[\]{}【】"'“”‘’]+/g;
    return text.replace(re, '').trim();
  }

  // ==========================================
  // 3. 注音與聲韻快取解析系統 (支援 Memoization 高效能)
  // ==========================================
  const _zhuyinCache = new Map();
  const _baseZhuyinCache = new Map();

  function getCharZhuyin(char) {
    if (!char) return "";
    if (_zhuyinCache.has(char)) return _zhuyinCache.get(char);
    let res = "";
    if (typeof window !== 'undefined' && window.ZHUYIN_MAP && window.ZHUYIN_MAP[char]) {
      res = window.ZHUYIN_MAP[char][0] || "";
    }
    _zhuyinCache.set(char, res);
    return res;
  }

  /**
   * 取得詞彙語境中的首字精確注音（優先自 WORD_OVERRIDES 提取，杜絕多音字在詞彙中發音失真）
   */
  function getWordHeadZhuyin(word) {
    if (!word) return "";
    if (typeof window !== 'undefined' && window.WORD_OVERRIDES && window.WORD_OVERRIDES[word] && window.WORD_OVERRIDES[word].h) {
      return window.WORD_OVERRIDES[word].h;
    }
    return getCharZhuyin(word[0]);
  }

  /**
   * 取得詞彙語境中的尾字精確注音（優先自 WORD_OVERRIDES 提取，如「口吃」尾字為ㄐㄧˊ）
   */
  function getWordTailZhuyin(word) {
    if (!word) return "";
    if (typeof window !== 'undefined' && window.WORD_OVERRIDES && window.WORD_OVERRIDES[word] && window.WORD_OVERRIDES[word].t) {
      return window.WORD_OVERRIDES[word].t;
    }
    return getCharZhuyin(word[word.length - 1]);
  }

  function getCharAllReadings(char) {
    if (typeof window !== 'undefined' && window.ZHUYIN_MAP && window.ZHUYIN_MAP[char]) {
      const entry = window.ZHUYIN_MAP[char];
      if (entry.length >= 3 && Array.isArray(entry[2]) && entry[2].length > 0) {
        return entry[2];
      }
      return [[entry[0], entry[1]]];
    }
    return [];
  }

  function getCharPinyin(char) {
    if (typeof window !== 'undefined') {
      if (window.ZHUYIN_MAP && window.ZHUYIN_MAP[char]) {
        return window.ZHUYIN_MAP[char][1];
      }
      if (window.LEXICON_SCORED && window.LEXICON_SCORED[char] && window.LEXICON_SCORED[char].py) {
        return window.LEXICON_SCORED[char].py;
      }
    }
    return "";
  }

  function normalizePinyin(py) {
    if (!py) return "";
    return py.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }

  function parseZhuyinTone(zhuyin) {
    if (!zhuyin) return 1;
    if (zhuyin.includes("ˊ")) return 2;
    if (zhuyin.includes("ˇ")) return 3;
    if (zhuyin.includes("ˋ")) return 4;
    if (zhuyin.includes("˙")) return 5;
    return 1;
  }

  function getBaseZhuyin(zhuyin) {
    if (!zhuyin) return "";
    if (_baseZhuyinCache.has(zhuyin)) return _baseZhuyinCache.get(zhuyin);
    const res = zhuyin.replace(/[ˊˇˋ˙]/g, "");
    _baseZhuyinCache.set(zhuyin, res);
    return res;
  }

  // ==========================================
  // 4. 音韻比對核心演算法 (checkPhoneticMatch)
  // ==========================================
  function checkPhoneticMatch(targetChar, headChar, allowHomo = true, strictTone = true, targetWord = "", headWord = "") {
    if (!targetChar || !headChar) {
      return { match: false, reason: "字元無效！" };
    }

    // 1. 同字直咬 (Exact character match)
    if (targetChar === headChar) {
      const tZh = targetWord ? getWordTailZhuyin(targetWord) : getCharZhuyin(targetChar);
      const hZh = headWord ? getWordHeadZhuyin(headWord) : getCharZhuyin(headChar);
      const displayZh = hZh || tZh;
      return { match: true, isExact: true, desc: "👑同字直咬", matchingZhuyin: displayZh, targetZhuyin: displayZh };
    }

    if (!allowHomo) {
      return { match: false, reason: `本局設定「僅限同字直咬」，首字必須為「${targetChar}」！` };
    }

    // 2. 詞彙語境讀音比對 (Contextual Word Phonetics - 具體詞彙發音優先)
    const actualTargetZh = targetWord ? getWordTailZhuyin(targetWord) : getCharZhuyin(targetChar);
    const actualHeadZh = headWord ? getWordHeadZhuyin(headWord) : getCharZhuyin(headChar);

    if (actualTargetZh && actualHeadZh) {
      const tBase = getBaseZhuyin(actualTargetZh);
      const hBase = getBaseZhuyin(actualHeadZh);
      const tTone = parseZhuyinTone(actualTargetZh);
      const hTone = parseZhuyinTone(actualHeadZh);

      if (tBase && hBase && tBase === hBase) {
        if (tTone === hTone) {
          return {
            match: true,
            isExact: false,
            desc: `🎵同音同調 (${headChar}:${actualHeadZh} ⇋ ${targetChar}:${actualTargetZh})`,
            matchingZhuyin: actualHeadZh,
            targetZhuyin: actualTargetZh
          };
        }

        // 基音相符但主音聲調不符：進一步檢查多音/破音字庫 (Polyphonic Tone Adaptation)
        const hasHeadExplicit = !!(typeof window !== 'undefined' && headWord && window.WORD_OVERRIDES && window.WORD_OVERRIDES[headWord] && window.WORD_OVERRIDES[headWord].h);
        const hasTargetExplicit = !!(typeof window !== 'undefined' && targetWord && window.WORD_OVERRIDES && window.WORD_OVERRIDES[targetWord] && window.WORD_OVERRIDES[targetWord].t);

        if (!hasHeadExplicit) {
          const headReadings = getCharAllReadings(headChar);
          for (const [hZh] of headReadings) {
            if (getBaseZhuyin(hZh) === tBase && parseZhuyinTone(hZh) === tTone) {
              return {
                match: true,
                isExact: false,
                desc: `🎵同音同調 (${headChar}:${hZh} ⇋ ${targetChar}:${actualTargetZh})`,
                matchingZhuyin: hZh,
                targetZhuyin: actualTargetZh
              };
            }
          }
        }

        if (!hasTargetExplicit) {
          const targetReadings = getCharAllReadings(targetChar);
          for (const [tZh] of targetReadings) {
            if (getBaseZhuyin(tZh) === hBase && parseZhuyinTone(tZh) === hTone) {
              return {
                match: true,
                isExact: false,
                desc: `🎵同音同調 (${headChar}:${actualHeadZh} ⇋ ${targetChar}:${tZh})`,
                matchingZhuyin: actualHeadZh,
                targetZhuyin: tZh
              };
            }
          }
        }

        // 若兩者均無匹配之聲調
        if (!strictTone) {
          return {
            match: true,
            isExact: false,
            desc: `🎶同音通押 (${headChar}:${actualHeadZh} ⇋ ${targetChar}:${actualTargetZh})`,
            matchingZhuyin: actualHeadZh,
            targetZhuyin: actualTargetZh
          };
        } else {
          return {
            match: false,
            reason: `開啟「嚴格同調」！「${targetChar}」為第 ${tTone} 聲 (${actualTargetZh})，而「${headChar}」為第 ${hTone} 聲 (${actualHeadZh})，聲調不符！`
          };
        }
      } else if (targetWord && headWord) {
        // 兩造均為具體詞彙且基音不符
        const hasHeadExplicit = !!(typeof window !== 'undefined' && window.WORD_OVERRIDES && window.WORD_OVERRIDES[headWord] && window.WORD_OVERRIDES[headWord].h);
        const hasTargetExplicit = !!(typeof window !== 'undefined' && window.WORD_OVERRIDES && window.WORD_OVERRIDES[targetWord] && window.WORD_OVERRIDES[targetWord].t);

        let crossMatch = null;
        if (!hasHeadExplicit) {
          const headReadings = getCharAllReadings(headChar);
          for (const [hZh] of headReadings) {
            const hb = getBaseZhuyin(hZh);
            const ht = parseZhuyinTone(hZh);
            if (hb === tBase) {
              if (ht === tTone) {
                return {
                  match: true,
                  isExact: false,
                  desc: `🎵同音同調 (${headChar}:${hZh} ⇋ ${targetChar}:${actualTargetZh})`,
                  matchingZhuyin: hZh,
                  targetZhuyin: actualTargetZh
                };
              } else if (!strictTone && !crossMatch) {
                crossMatch = { hZh, tZh: actualTargetZh };
              }
            }
          }
        }
        if (!hasTargetExplicit) {
          const targetReadings = getCharAllReadings(targetChar);
          for (const [tZh] of targetReadings) {
            const tb = getBaseZhuyin(tZh);
            const tt = parseZhuyinTone(tZh);
            if (tb === hBase) {
              if (tt === hTone) {
                return {
                  match: true,
                  isExact: false,
                  desc: `🎵同音同調 (${headChar}:${actualHeadZh} ⇋ ${targetChar}:${tZh})`,
                  matchingZhuyin: actualHeadZh,
                  targetZhuyin: tZh
                };
              } else if (!strictTone && !crossMatch) {
                crossMatch = { hZh: actualHeadZh, tZh };
              }
            }
          }
        }

        if (crossMatch && !strictTone) {
          return {
            match: true,
            isExact: false,
            desc: `🎶同音通押 (${headChar}:${crossMatch.hZh} ⇋ ${targetChar}:${crossMatch.tZh})`,
            matchingZhuyin: crossMatch.hZh,
            targetZhuyin: crossMatch.tZh
          };
        }

        return {
          match: false,
          reason: `首字「${headChar}」(${actualHeadZh}) 與目標「${targetChar}」(${actualTargetZh}) 聲韻不合！`
        };
      }
    }

    // 3. 多音字比對 (單字無詞彙語境時)
    const targetReadings = getCharAllReadings(targetChar);
    const headReadings = getCharAllReadings(headChar);

    if (targetReadings.length > 0 && headReadings.length > 0) {
      let toneMismatchCandidate = null;

      for (const [tZh] of targetReadings) {
        const tBase = getBaseZhuyin(tZh);
        const tTone = parseZhuyinTone(tZh);
        for (const [hZh] of headReadings) {
          const hBase = getBaseZhuyin(hZh);
          const hTone = parseZhuyinTone(hZh);

          if (tBase && hBase && tBase === hBase) {
            if (tTone === hTone) {
              return {
                match: true,
                isExact: false,
                desc: `🎵同音同調 (${headChar}:${hZh} ⇋ ${targetChar}:${tZh})`,
                matchingZhuyin: hZh,
                targetZhuyin: tZh
              };
            } else if (!toneMismatchCandidate) {
              toneMismatchCandidate = { tZh, tTone, hZh, hTone };
            }
          }
        }
      }

      if (!strictTone && toneMismatchCandidate) {
        const { tZh, hZh } = toneMismatchCandidate;
        return {
          match: true,
          isExact: false,
          desc: `🎶同音通押 (${headChar}:${hZh} ⇋ ${targetChar}:${tZh})`,
          matchingZhuyin: hZh,
          targetZhuyin: tZh
        };
      }

      if (strictTone && toneMismatchCandidate) {
        const { tZh, tTone, hZh, hTone } = toneMismatchCandidate;
        return {
          match: false,
          reason: `開啟「嚴格同調」！「${targetChar}」為第 ${tTone} 聲 (${tZh})，而「${headChar}」為第 ${hTone} 聲 (${hZh})，聲調不符！`
        };
      }
    }

    // 4. 備援拼音比對
    const targetPyNorm = normalizePinyin(getCharPinyin(targetChar));
    const headPyNorm = normalizePinyin(getCharPinyin(headChar));
    if (targetPyNorm && headPyNorm && targetPyNorm === headPyNorm) {
      const tZh = actualTargetZh || getCharZhuyin(targetChar);
      const hZh = actualHeadZh || getCharZhuyin(headChar);
      if (strictTone && tZh && hZh) {
        if (parseZhuyinTone(tZh) !== parseZhuyinTone(hZh)) {
          return { match: false, reason: `開啟「嚴格同調」！聲調不符！` };
        }
      }
      return {
        match: true,
        isExact: false,
        desc: "🎵同音通押",
        matchingZhuyin: hZh || tZh,
        targetZhuyin: tZh || hZh
      };
    }

    const primaryTargetZh = actualTargetZh || getCharZhuyin(targetChar);
    const primaryHeadZh = actualHeadZh || getCharZhuyin(headChar);
    const headInfo = primaryHeadZh ? `「${headChar}」(${primaryHeadZh})` : `「${headChar}」`;
    const targetInfo = primaryTargetZh ? `「${targetChar}」(${primaryTargetZh})` : `「${targetChar}」`;

    return {
      match: false,
      reason: `首字${headInfo} 與目標${targetInfo} 聲韻不合！`
    };
  }

  // ==========================================
  // 5. 臺灣諧音雙關梗庫與真諧音檢測 (True Pun Detection)
  // ==========================================
  const TAIWAN_PUN_MAP = {
    "無蟹可及": "無懈可擊",
    "深得茗心": "深得民心",
    "鹽陣以待": "嚴陣以待",
    "諧教": "邪教",
    "薪痛": "心痛",
    "童心協力": "同心協力",
    "難兄男弟": "難兄難弟",
    "一童享受": "一同享受",
    "朝三暮適": "朝三暮四",
    "鴨梨山大": "壓力山大",
    "泰想念你": "太想念你",
    "香煎恨晚": "相見恨晚",
    "別苣一格": "別具一格",
    "大橘已定": "大局已定",
    "萬柿具備": "萬事具備",
    "好事花生": "好事發生",
    "洗出望外": "喜出望外",
    "辛照不宣": "心照不宣",
    "投桃報理": "投桃報李",
    "食全食美": "十全十美",
    "百衣百順": "百依百順",
    "一茗驚人": "一鳴驚人",
    "衣網打盡": "一網打盡",
    "衣見鍾情": "一見鍾情",
    "衣衣不捨": "依依不捨",
    "大展烘圖": "大展宏圖",
    "金芋良言": "金玉良言",
    "甜言蜜芋": "甜言蜜語",
    "點食成金": "點石成金",
    "步步為贏": "步步為營",
    "飲以為傲": "引以為傲",
    "悲水車薪": "杯水車薪",
    "潔盡全力": "竭盡全力",
    "晶益求精": "精益求精",
    "如獲炙寶": "如獲至寶",
    "寶石終日": "飽食終日",
    "烤出狂言": "口出狂言",
    "名列前貓": "名列前茅",
    "喵不可言": "妙不可言",
    "舞與倫比": "無與倫比",
    "健微知著": "見微知著",
    "柏步穿楊": "百步穿楊",
    "喵手回春": "妙手回春",
    "辛曠神怡": "心曠神怡",
    "添衣無縫": "天衣無縫",
    "雞不可失": "機不可失",
    "前鋪後繼": "前仆後繼",
    "投棋所好": "投其所好",
    "步步糕陞": "步步高陞",
    "胸有成豬": "胸有成竹",
    "笙笙不息": "生生不息",
    "一夜知秋": "一葉知秋",
    "隨芋而安": "隨遇而安",
    "香淨如賓": "相敬如賓",
    "油求必應": "有求必應",
    "開卷有義": "開卷有益",
    "忘梅止渴": "望梅止渴",
    "掌上名豬": "掌上明珠",
    "獸比南山": "壽比南山",
    "富貴吉香": "富貴吉祥",
    "如日鍾天": "如日中天",
    "仙發制人": "先發制人",
    "順李成章": "順理成章",
    "李所當然": "理所當然",
    "金疲力竭": "精疲力竭",
    "一鷹俱全": "一應俱全",
    "雞會難得": "機會難得",
    "茶言觀色": "察言觀色",
    "有茗有姓": "有名有姓",
    "相敬如冰": "相敬如賓",
    "大器碗成": "大器晚成",
    "字戀狂": "自戀狂",
    "字作自受": "自作自受",
    "字鳴得意": "自鳴得意",
    "字高自大": "自高自大",
    "字私自利": "自私自利",
    "字顧不暇": "自顧不暇",
    "字圓其說": "自圓其說",
    "字給自足": "自給自足",
    "字成一家": "自成一家",
    "字吹自擂": "自吹自擂",
    "字怨自艾": "自怨自艾",
    "字慚形穢": "自慚形穢",
    "字欺欺人": "自欺欺人",
    "字投羅網": "自投羅網",
    "字生自滅": "自生自滅",
    "字由自在": "自由自在",
    "字命不凡": "自命不凡",
    "字暴自棄": "自暴自棄",
    "字始至終": "自始至終",
    "字相矛盾": "自相矛盾",
    "字得其樂": "自得其樂",
    "字作主張": "自作主張",
    "字作多情": "自作多情",
    "字立更生": "自力更生",
    "字字珠璣": "自字珠璣",
    "字裡行間": "自裡行間"
  };

  function checkTruePun(word, lexicon = null) {
    if (!word || typeof word !== "string") return null;
    if (TAIWAN_PUN_MAP[word]) {
      return { isPun: true, original: TAIWAN_PUN_MAP[word] };
    }
    return null;
  }

  return {
    showToast,
    extractCJKChars,
    getHeadChar,
    getTailChar,
    cleanInputWord,
    getCharZhuyin,
    getWordHeadZhuyin,
    getWordTailZhuyin,
    getCharAllReadings,
    getCharPinyin,
    normalizePinyin,
    parseZhuyinTone,
    getBaseZhuyin,
    checkPhoneticMatch,
    TAIWAN_PUN_MAP,
    checkTruePun
  };
});
