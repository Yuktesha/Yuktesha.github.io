/**
 * 字戀 (WordChain) - Web Core Engine
 * 臺灣正體 · 文壇縱橫二維交錯字陣 · 漢字聲韻博弈
 * 零外部依賴、純前端執行、支援離線與 GitHub Pages 部署
 */

// ==========================================
// 1. 全域非侵入式 Toast 提示 (100% 杜絕彈跳視窗與 IME 跑位)
// ==========================================
function showToast(message, type = "info", duration = 3500) {
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
// 2. 漢字注音聲調與聲韻解析系統
// ==========================================
function getCharZhuyin(char) {
  if (window.ZHUYIN_MAP && window.ZHUYIN_MAP[char]) {
    return window.ZHUYIN_MAP[char][0];
  }
  return "";
}

/**
 * 取得詞彙語境中的首字精確注音（優先自 WORD_OVERRIDES 提取，杜絕多音字在詞彙中發音失真）
 */
function getWordHeadZhuyin(word) {
  if (!word) return "";
  if (window.WORD_OVERRIDES && window.WORD_OVERRIDES[word] && window.WORD_OVERRIDES[word].h) {
    return window.WORD_OVERRIDES[word].h;
  }
  return getCharZhuyin(word[0]);
}

/**
 * 取得詞彙語境中的尾字精確注音（優先自 WORD_OVERRIDES 提取，如「口吃」尾字為ㄐㄧˊ）
 */
function getWordTailZhuyin(word) {
  if (!word) return "";
  if (window.WORD_OVERRIDES && window.WORD_OVERRIDES[word] && window.WORD_OVERRIDES[word].t) {
    return window.WORD_OVERRIDES[word].t;
  }
  return getCharZhuyin(word[word.length - 1]);
}

function getCharAllReadings(char) {
  if (window.ZHUYIN_MAP && window.ZHUYIN_MAP[char]) {
    const entry = window.ZHUYIN_MAP[char];
    if (entry.length >= 3 && Array.isArray(entry[2]) && entry[2].length > 0) {
      return entry[2];
    }
    return [[entry[0], entry[1]]];
  }
  return [];
}

function getCharPinyin(char) {
  if (window.ZHUYIN_MAP && window.ZHUYIN_MAP[char]) {
    return window.ZHUYIN_MAP[char][1];
  }
  if (window.LEXICON_SCORED && window.LEXICON_SCORED[char] && window.LEXICON_SCORED[char].py) {
    return window.LEXICON_SCORED[char].py;
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
  return zhuyin.replace(/[ˊˇˋ˙]/g, "");
}

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
      // 若首字未被強制指定相異詞義音讀，且其字典收錄了與目標同調之音讀，判定為合法同調破音字！
      const hasHeadExplicit = !!(headWord && window.WORD_OVERRIDES && window.WORD_OVERRIDES[headWord] && window.WORD_OVERRIDES[headWord].h);
      const hasTargetExplicit = !!(targetWord && window.WORD_OVERRIDES && window.WORD_OVERRIDES[targetWord] && window.WORD_OVERRIDES[targetWord].t);

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
      // 若首字未被強制鎖定音讀，檢查是否在首字多音字中有與目標基音完全匹配者
      const hasHeadExplicit = !!(window.WORD_OVERRIDES && window.WORD_OVERRIDES[headWord] && window.WORD_OVERRIDES[headWord].h);
      const hasTargetExplicit = !!(window.WORD_OVERRIDES && window.WORD_OVERRIDES[targetWord] && window.WORD_OVERRIDES[targetWord].t);

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

    for (const [tZh, tPy] of targetReadings) {
      const tBase = getBaseZhuyin(tZh);
      const tTone = parseZhuyinTone(tZh);
      for (const [hZh, hPy] of headReadings) {
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
// 2.5 臺灣諧音雙關梗庫與真諧音檢測 (True Pun Detection)
// 依據傳統修辭與使用者明確定義：「『諧音』應該是正常詞彙的同音不同字產生不同意義才稱得上諧音魂。」
// 嚴格區分一般的「🎵借音通押 (同音不同字接龍)」與「🤣真正的諧音雙關梗 (Pun)」
// ==========================================
const TAIWAN_PUN_MAP = {
  // 知名食物/品牌/招牌/生活成語諧音雙關梗
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
  // 字戀專屬諧音趣味詞
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
  // 1. 已收錄經典諧音雙關庫
  if (TAIWAN_PUN_MAP[word]) {
    return { isPun: true, original: TAIWAN_PUN_MAP[word] };
  }
  return null;
}

// ==========================================
// 3. 文人 AI 人設與機鋒矩陣
// ==========================================
const PERSONAS = {
  ji_xiaolan: {
    name: "紀曉嵐",
    title: "四庫全書總纂官 · 毒舌博學派",
    icon: "🧐"
  },
  li_bai: {
    name: "李白",
    title: "青蓮劍仙 · 豪放詩仙派",
    icon: "🍶"
  },
  bao_zheng: {
    name: "包拯",
    title: "開封府尹 · 鐵面判官派",
    icon: "⚖️"
  }
};

const DIALOGUE_MATRIX = {
  ji_xiaolan: {
    kill: [
      w => `哈哈！老夫此一式【${w}】，退路已盡！閣下這條小舟，已然擱淺在死局淺灘了！`,
      w => `出此【${w}】，落子如封喉利刃。四庫全書翻遍，閣下也尋不出半個生路！`,
      (w, t) => `留你這「${t}」字，天上地下皆無門。且飲杯熱茶，認輸罷休了吧！`,
      w => `一式【${w}】定乾坤！任你三頭六臂，遇此死穴亦回天乏術矣！`
    ],
    danger: [
      (w, t) => `打出【${w}】，前路只剩三兩步羊腸小道。看閣下還能在懸崖邊跳多久！`,
      w => `老夫這手【${w}】可謂敲山震虎，閣下已是泥菩薩過江，自身難保嘍！`,
      (w, t) => `【${w}】留給你的「${t}」字甚險，稍有不慎，便是滿盤皆輸！`,
      w => `前路如履薄冰，老夫這【${w}】可不是隨便出的，閣下小心失足墜崖！`
    ],
    long: [
      w => `洋洋灑灑【${w}】，文字成藥，既可養生亦可制敵，不知閣下可咽得下？`,
      w => `四庫浩瀚，誰說成語必拘於四字？【${w}】長驅直入，看你如何拆解！`,
      w => `妙筆生花打出【${w}】，此等長句成藥，最是考驗文膽功底！`
    ],
    homo: [
      (w, t, h) => `音通意達！老夫以同音「${h}」借力打力，打出【${w}】，這叫聲東擊西！`,
      w => `音諧韻暢，此乃文人雅趣。這手【${w}】接得巧，老夫且看你如何接唱！`,
      w => `雖非本字，但音律相合。這手【${w}】亦算得上一記奇兵吧！`
    ],
    exact: [
      (w, t, h) => `正本清源，同字直咬！「${h}」字剛勁無比，這招【${w}】堂堂正正！`,
      w => `一絲不苟，直取中宮！老夫這手【${w}】字正腔圓，接招！`,
      (w, t, h) => `咬定「${h}」字不放鬆！【${w}】如秋水長天，閣下接得下來嗎？`
    ],
    learned: [
      w => `【學以致用】「這可是閣下上次教老夫的【${w}】，今日物歸原主，感覺如何？」`,
      w => `現學現賣，信手拈來！閣下親授之【${w}】，威力果然不同凡響！`
    ],
    opening: [
      `文思泉湧，詞海弄潮！敢問閣下——您今天字戀了沒？`,
      `四庫全書在胸，天下文章歸我。閣下今日字戀，可有把握招架？`,
      `請閣下先出招，且看今日文壇，究竟誰能自戀到底、稱霸詞海！`
    ],
    general: [
      w => `接得倒快！不過這【${w}】在四庫全書裡也只能算得中品，且看老夫手段！`,
      w => `哼，這點小把戲，當年和珅都不敢在老夫面前班門弄斧！看招【${w}】！`,
      w => `行家一出手，便知有沒有。這手【${w}】出將去，且看今日文壇誰稱雄！`,
      w => `筆下龍蛇走，紙上風雷疾！這記【${w}】，敬請閣下指教！`,
      w => `文如流水意如雲，這手【${w}】老夫自認平生得意之筆！`
    ]
  },
  li_bai: {
    kill: [
      w => `哈哈哈哈！十步殺一人，千里不留行！李白這手【${w}】，已是絕壁千仞無生路矣！`,
      w => `大鵬一日同風起，一式【${w}】定乾坤！閣下休要掙扎，與我同醉罷休！`,
      w => `杯酒破萬軍，長嘯動山河！這【${w}】乃李某絕命仙劍，閣下氣數已盡！`
    ],
    danger: [
      w => `蜀道之難難於上青天！這記【${w}】出招，閣下前路險如猿猱愁攀！`,
      w => `行路難，多歧路！李某這手【${w}】直逼險境，閣下且小心應對！`,
      (w, t) => `狂風吹倒百花殘，留此「${t}」字若危崖！閣下可還站得穩腳跟？`
    ],
    long: [
      w => `仰天大笑出門去，文字縱橫豈受拘束！長句【${w}】，方顯太白豪放本色！`,
      w => `呼兒將出換美酒，與爾同銷萬古愁！這【${w}】似黃河之水天上下來！`
    ],
    homo: [
      w => `音韻相通，宛若仙樂自天外來！同音打出【${w}】，李某圖的就是個痛快！`,
      w => `詩酒放浪，何必拘泥死板字形？這手【${w}】諧音得趣，當浮一大白！`
    ],
    exact: [
      (w, t, h) => `同字硬咬，金鐵交鳴！「${h}」字鋒芒如青蓮劍出鞘，接招【${w}】！`,
      w => `直擊中宮，力拔山兮！這記【${w}】乃太白正統劍意，痛快！`
    ],
    learned: [
      w => `【仙人借劍】「哈哈！此【${w}】乃閣下昔日所贈佳句，李某今日借花獻佛！」`,
      w => `好詩好句，李白過目不忘！這手【${w}】正是閣下所教，妙哉！`
    ],
    opening: [
      `仰天大笑出門去，我輩豈是蓬蒿人！今日且隨太白，一同字戀三千場！`,
      `人生得意須盡歡，千金散盡還復來！敢問閣下——您今天字戀了沒？`,
      `飛流直下三千尺，文字江山唯我狂！請閣下先行出招！`
    ],
    general: [
      w => `妙哉！當浮一大白！閣下出招頗有仙氣，且看李白這記【${w}】！`,
      w => `興酣落筆搖五嶽，詩成笑傲凌滄洲！且接我這手【${w}】！`,
      w => `花間一壺酒，獨酌無相親。有閣下這般對手，今日痛快至極！出招【${w}】！`,
      w => `飛流直下三千尺，疑是銀河落九天！看劍——【${w}】！`,
      w => `事了拂衣去，深藏身與名！這招【${w}】，閣下可能接招？`
    ]
  },
  bao_zheng: {
    kill: [
      w => `法網恢恢，疏而不漏！本府這記【${w}】乃銅鍘索命，閣下斷無生路！`,
      w => `鐵案如山，生門已鎖！此式【${w}】落定，乾坤朗朗，閣下認輸吧！`,
      w => `死生之界，判然分明！【${w}】如御賜尚方寶劍，立斬所有生機！`
    ],
    danger: [
      w => `擊鼓鳴冤，字字千鈞！這手【${w}】如大堂威武棒，閣下休得心存僥倖！`,
      (w, t) => `明察秋毫！此「${t}」字險象環生，閣下若無良策，休怪本府公事公辦！`,
      w => `堂鼓陣陣，步步緊逼！這招【${w}】直逼要害，閣下已是如坐針氈！`
    ],
    long: [
      w => `律法森嚴，辭章弘遠！五言長句【${w}】，正如判詞宏麗，字字誅心！`,
      w => `文正則意端，這篇【${w}】言之鑿鑿，本府依法出招！`
    ],
    homo: [
      w => `借音斷句，曲直分明！同音取義出【${w}】，公堂博弈亦重通變之智！`,
      w => `聲諧理正，合乎律令！本府這手【${w}】，依法准予接龍！`
    ],
    exact: [
      (w, t, h) => `同字對證，黑白分明！本府以「${h}」字秉公執法，打出【${w}】！`,
      w => `不偏不倚，堂堂正正！這手【${w}】如青天白日，豈容辯駁！`
    ],
    learned: [
      w => `【秉公備案】「閣下前次所呈供之【${w}】，經本府勘驗屬實，今特當庭驗收！」`,
      w => `開誠布公，此【${w}】乃閣下親授，本府秉公引用！`
    ],
    opening: [
      `鐵面無私，文心自照！公堂字海對弈，敢問閣下——您今天字戀了沒？`,
      `公堂博弈，字字有據。請閣下出招，自展風華！`,
      `法度森嚴，筆鋒如刀！且看閣下今日如何字戀破局！`
    ],
    general: [
      w => `公堂之上，豈容兒戲！本府接下此招，還敬【${w}】！`,
      w => `鐵面無私，清風兩袖！且看本府這手【${w}】，接招！`,
      w => `明鏡高懸，照澈文海！這記【${w}】有據可查，請閣下出招！`,
      w => `字斟句酌，案無留牘！本府這記【${w}】，浩然之氣貫徹始終！`,
      w => `法度森嚴，筆鋒如刀！閣下休得慌亂，且對這手【${w}】！`
    ]
  }
};

function generateSituationalBanter(personaKey, currentWord, lastWord, strategyNote = "") {
  const personaDict = DIALOGUE_MATRIX[personaKey] || DIALOGUE_MATRIX["ji_xiaolan"];
  const w = cleanInputWord(currentWord);
  const tailC = getTailChar(w);
  const headC = getHeadChar(w);
  const lastTail = getTailChar(lastWord);

  const isKill = strategyNote.includes("絕殺") || strategyNote.includes("0 步") || strategyNote.includes("一擊");
  const isDanger = strategyNote.includes("險局") || strategyNote.includes("1 步") || strategyNote.includes("2 步") || strategyNote.includes("3 步") || strategyNote.includes("逼殺") || strategyNote.includes("壓迫");
  const isLearned = strategyNote.includes("學以致用");
  const isExact = (headC === lastTail);
  const isLong = (w.length >= 5);

  let pool = personaDict.general;
  if (isLearned) pool = personaDict.learned;
  else if (isKill) pool = personaDict.kill;
  else if (isDanger) pool = personaDict.danger;
  else if (isLong) pool = personaDict.long;
  else if (!isExact) pool = personaDict.homo;
  else if (isExact && Math.random() < 0.6) pool = personaDict.exact;

  const fn = pool[Math.floor(Math.random() * pool.length)];
  return fn(w, tailC, headC);
}

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
// 4. 核心遊戲引擎 WordChainWeb
// ==========================================
class WordChainWeb {
  constructor() {
    this.lexicon = null;
    this.zhuyinMap = {};
    this.battleUsedWords = new Set();
    this.battleCurrentWord = "天馬行空";
    this.demoUsedWords = new Set();
    this.demoCurrentWord = "天馬行空";
    this.roundCount = 1;

    // 對弈選項
    this.currentPersona = "ji_xiaolan";
    this.difficulty = "normal";
    this.allowHomophone = true;
    this.strictTone = true;

    // 氣血與積分 (1000 HP 長局纏鬥體制)
    this.playerScore = 0;
    this.aiScore = 0;
    this.maxHp = 1000;
    this.playerHp = 1000;
    this.aiHp = 1000;
    this.playerPhoneticCount = 0; // 聲律「借音通押」妙招累計
    this.playerPhoneticCombo = 0; // 連續借音連擊數
    this.playerExactCount = 0; // 原字直咬累計
    this.playerExactCombo = 0; // 原字直咬連擊數
    this.playerTruePunCount = 0; // 真正臺灣在地「深入骨髓諧音魂」雙關梗累計
    this.playerExactPunCount = 0; // 原字諧音雙關累計
    this.playerPunWords = []; // 本局打出之諧音雙關梗記錄
    this.playerHomophoneCount = 0; // 相容別名
    this.playerHomophoneCombo = 0; // 相容別名
    this.lastHomoBadge = "";
    this.lastBadgeType = "";
    this.lastBestWord = "";
    this.lastBestLen = 0;

    // 計時器
    this.timeLimit = 30;
    this.timerSecondsLeft = 30;
    this.timerId = null;
    this.turnStartTime = Date.now();
    this.hasPlayerStarted = false; // 等候玩家接出第一個詞彙才正式起鐘計時

    // 棋盤狀態 (2D Cross-Grid)
    this.boardMap = new Map(); // key: `${row},${col}` => cell data
    this.lastTailCoord = { row: 4, col: 3 };
    this.lastDirection = 'horizontal'; // 'horizontal' or 'vertical'
    this.minRow = 4;
    this.maxRow = 4;
    this.minCol = 3;
    this.maxCol = 3;
    let savedStyle = "tile";
    try { savedStyle = localStorage.getItem("wordchain_homo_style") || "tile"; } catch {}
    this.homoStyle = savedStyle; // 'tile' (A), 'bridge' (B), 'flip' (C)

    // 雙雄演示狀態 (嚴格隔離獨立運作)
    this.isDemoRunning = false;
    this.demoTimer = null;
    this.demoTurn = 1;
    this.demoP1 = "ji_xiaolan";
    this.demoP2 = "li_bai";
    this.demoRound = 1;
    this.demoBoardMap = new Map();
    this.demoLastTailCoord = { row: 4, col: 3 };
    this.demoLastDirection = 'horizontal';
    this.demoMinRow = 4;
    this.demoMaxRow = 4;
    this.demoMinCol = 3;
    this.demoMaxCol = 3;
    this.demoHistoryLogs = [];

    // 自學詞庫與軍師錦囊
    this.learnedWords = this.loadLearnedWords();
    this.hintActive = false;
    this.currentHints = [];

    // 地理位置探知（科學園區精準推測：竹科、內科、汐科、南科、中科）
    this.userTechPark = "竹科";
    this.detectUserTechPark();

    this.initSplash();
    this.initDOM();
    this.loadLexicon();
  }

  get currentWord() {
    return this.isDemoRunning ? this.demoCurrentWord : this.battleCurrentWord;
  }

  set currentWord(val) {
    if (this.isDemoRunning) this.demoCurrentWord = val;
    else this.battleCurrentWord = val;
  }

  get usedWords() {
    return this.isDemoRunning ? this.demoUsedWords : this.battleUsedWords;
  }

  set usedWords(val) {
    if (this.isDemoRunning) this.demoUsedWords = val;
    else this.battleUsedWords = val;
  }

  loadLearnedWords() {
    try {
      const data = localStorage.getItem("wordchain_learned_words");
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  saveLearnedWords() {
    try {
      localStorage.setItem("wordchain_learned_words", JSON.stringify(this.learnedWords));
    } catch (e) {
      console.error(e);
    }
  }

  updateLexiconBadge(fullText, medText, shortText, isReady = true) {
    const statusEl = document.getElementById("loading-status");
    if (!statusEl) return;
    statusEl.innerHTML = `
      <span class="status-dot ${isReady ? 'ready' : 'loading'}"></span>
      <span class="status-text-full">${fullText}</span>
      <span class="status-text-med">${medText}</span>
      <span class="status-text-short">${shortText}</span>
    `;
    statusEl.title = fullText;
  }

  async loadLexicon() {
    // 1. 優先使用 script 標籤載入的全域變數 (保證 file:/// 與零延遲)
    if (window.LEXICON_SCORED) {
      this.lexicon = window.LEXICON_SCORED;
      this.zhuyinMap = window.ZHUYIN_MAP || {};
      this.updateLexiconBadge("臺灣萌典詞庫已就緒 (14.7萬正體詞)", "萌典 14.7萬詞", "14.7萬詞", true);
      this.startNewBattle();
      return;
    }

    // 2. 備援 fetch
    try {
      const resp = await fetch("lexicon_scored.json");
      this.lexicon = await resp.json();
      try {
        const zhResp = await fetch("zhuyin_map.json");
        this.zhuyinMap = await zhResp.json();
      } catch (zhErr) {
        console.warn("zhuyin_map.json load warning", zhErr);
      }
      this.updateLexiconBadge("臺灣萌典詞庫已就緒 (14.7萬正體詞)", "萌典 14.7萬詞", "14.7萬詞", true);
      this.startNewBattle();
    } catch (e) {
      console.error("Failed to load scored lexicon", e);
      this.updateLexiconBadge("載入備援模式", "備援模式", "備援", false);
      this.startNewBattle();
    }
  }

  initDOM() {
    // 導航標籤頁切換 (人機對決、雙雄演示秀共用單一棋盤舞台，依模式無縫切換)
    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-target");
        if (target === "tab-battle") {
          this.setGameMode("battle");
        } else if (target === "tab-demo") {
          this.setGameMode("demo");
        } else if (target === "tab-learned") {
          document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
          document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
          btn.classList.add("active");
          const targetPane = document.getElementById("tab-learned");
          if (targetPane) targetPane.classList.add("active");
          this.stopTimer();
          if (this.isDemoRunning) {
            if (this.demoTimer) clearInterval(this.demoTimer);
            this.demoTimer = null;
            this.isDemoRunning = false;
          }
          this.renderLearnedTable();
        }
      });
    });

    // 模式下拉選單 (閣下親征 vs 雙雄相聲)
    const selGameMode = document.getElementById("select-game-mode");
    if (selGameMode) {
      selGameMode.addEventListener("change", (e) => {
        this.setGameMode(e.target.value);
      });
    }

    // 棋盤視圖切換 (盤 棋盤 vs 表 紀錄表 - 人機對決)
    const btnViewBoard = document.getElementById("btn-view-board");
    const btnViewTable = document.getElementById("btn-view-table");
    const boardViewport = document.getElementById("cross-board-viewport");
    const tableViewport = document.getElementById("table-stream-viewport");

    if (btnViewBoard && btnViewTable) {
      btnViewBoard.addEventListener("click", () => {
        btnViewBoard.classList.add("active");
        btnViewTable.classList.remove("active");
        if (boardViewport) boardViewport.style.display = "block";
        if (tableViewport) tableViewport.style.display = "none";
      });

      btnViewTable.addEventListener("click", () => {
        btnViewTable.classList.add("active");
        btnViewBoard.classList.remove("active");
        if (boardViewport) boardViewport.style.display = "none";
        if (tableViewport) tableViewport.style.display = "block";
      });
    }

    // 棋盤視圖切換 (雙雄演示相容)
    const btnDemoViewBoard = document.getElementById("btn-demo-view-board");
    const btnDemoViewTable = document.getElementById("btn-demo-view-table");
    const demoBoardViewport = document.getElementById("demo-board-viewport");
    const demoTableViewport = document.getElementById("demo-table-viewport");

    if (btnDemoViewBoard && btnDemoViewTable) {
      btnDemoViewBoard.addEventListener("click", () => {
        if (btnViewBoard) btnViewBoard.click();
      });
      btnDemoViewTable.addEventListener("click", () => {
        if (btnViewTable) btnViewTable.click();
      });
    }

    // 📖 右上角成語典故視窗：收合/展開與自由拖曳 (支援點擊標題收合與 handle 拖曳)
    const btnToggleWisdom = document.getElementById("btn-toggle-wisdom-dock");
    const wisdomDock = document.getElementById("wisdom-zoom-dock");
    if (btnToggleWisdom && wisdomDock) {
      // 在直版/行動端環境下，預設自動收合，保障棋盤 100% 開闊無遮擋 (rud 標準)
      const isPortraitTerminal = (window.innerWidth <= 768 || window.innerHeight > window.innerWidth);
      if (isPortraitTerminal) {
        wisdomDock.classList.add("minimized");
        btnToggleWisdom.innerText = "▾";
        btnToggleWisdom.title = "展開典故視窗";
      }

      btnToggleWisdom.addEventListener("click", (e) => {
        e.stopPropagation();
        wisdomDock.classList.toggle("minimized");
        btnToggleWisdom.innerText = wisdomDock.classList.contains("minimized") ? "▾" : "▴";
        btnToggleWisdom.title = wisdomDock.classList.contains("minimized") ? "展開典故視窗" : "收合典故視窗";
      });
    }
    if (wisdomDock) {
      this.makeDraggable(wisdomDock, "wordchain_wisdom_dock_pos", ".wisdom-drag-handle");
    }

    // ⚙️ 控制面板直版抽屜切換 (rud 行動自適應單行優先)
    const btnToggleOptions = document.getElementById("btn-toggle-options");
    const optionsDrawer = document.getElementById("control-options-drawer");
    if (btnToggleOptions && optionsDrawer) {
      btnToggleOptions.addEventListener("click", () => {
        optionsDrawer.classList.toggle("open");
        btnToggleOptions.classList.toggle("active", optionsDrawer.classList.contains("open"));
      });
    }

    // 📍 左下角整合式資訊儀表板相容切換
    const btnToggleHudBattle = document.getElementById("btn-toggle-hud-battle");
    const hudBattlePanel = document.getElementById("integrated-hud-battle");
    if (btnToggleHudBattle && hudBattlePanel) {
      btnToggleHudBattle.addEventListener("click", (e) => {
        e.stopPropagation();
        hudBattlePanel.classList.toggle("minimized");
      });
    }

    const btnToggleHudDemo = document.getElementById("btn-toggle-hud-demo");
    const hudDemoPanel = document.getElementById("integrated-hud-demo");
    if (btnToggleHudDemo && hudDemoPanel) {
      btnToggleHudDemo.addEventListener("click", (e) => {
        e.stopPropagation();
        hudDemoPanel.classList.toggle("minimized");
      });
    }

    // 視窗即攝影鏡頭：啟用字陣畫布按住攀移與光學縮放 (Camera Pan & Zoom)
    this.setupViewportPan(boardViewport);
    if (demoBoardViewport) this.setupViewportPan(demoBoardViewport);

    // 縮放 HUD 按鈕綁定 (已整合至右上角智慧卡)
    const btnZoomIn = document.getElementById("btn-zoom-in");
    const btnZoomOut = document.getElementById("btn-zoom-out");
    const btnZoomReset = document.getElementById("btn-zoom-reset");
    const zoomValBattle = document.getElementById("zoom-val-battle");
    if (btnZoomIn) btnZoomIn.addEventListener("click", () => this.zoomViewport(boardViewport, 0.15));
    if (btnZoomOut) btnZoomOut.addEventListener("click", () => this.zoomViewport(boardViewport, -0.15));
    if (btnZoomReset) btnZoomReset.addEventListener("click", () => this.recenterViewport(boardViewport, false, true));
    if (zoomValBattle) zoomValBattle.addEventListener("click", () => this.recenterViewport(boardViewport, false, true));

    // 縮放 HUD 按鈕綁定與自由拖曳 (雙雄演示)
    const hudDemo = document.getElementById("zoom-hud-demo");
    if (hudDemo) this.makeDraggable(hudDemo, "wordchain_zoom_hud_demo");

    const btnDemoZoomIn = document.getElementById("btn-demo-zoom-in");
    const btnDemoZoomOut = document.getElementById("btn-demo-zoom-out");
    const btnDemoZoomReset = document.getElementById("btn-demo-zoom-reset");
    const zoomValDemo = document.getElementById("zoom-val-demo");
    if (btnDemoZoomIn) btnDemoZoomIn.addEventListener("click", () => this.zoomViewport(demoBoardViewport, 0.15));
    if (btnDemoZoomOut) btnDemoZoomOut.addEventListener("click", () => this.zoomViewport(demoBoardViewport, -0.15));
    if (btnDemoZoomReset) btnDemoZoomReset.addEventListener("click", () => this.recenterViewport(demoBoardViewport, true, true));
    if (zoomValDemo) zoomValDemo.addEventListener("click", () => this.recenterViewport(demoBoardViewport, true, true));

    // 出招輸入與快捷鍵
    const inputEl = document.getElementById("input-word");
    if (inputEl) {
      inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.handlePlayerSubmit();
        }
      });
    }

    const btnSubmit = document.getElementById("btn-submit");
    if (btnSubmit) {
      btnSubmit.addEventListener("click", () => this.handlePlayerSubmit());
    }

    // 鍵盤軍師錦囊快捷鍵 (1~4 或 Alt+1~4)
    window.addEventListener("keydown", (e) => {
      if (this.hintActive && this.currentHints.length > 0) {
        const activeEl = document.activeElement;
        const isInputFocused = (activeEl && activeEl.id === "input-word");
        const inputVal = (inputEl ? inputEl.value : "").trim();

        if (["1", "2", "3", "4"].includes(e.key) && !e.ctrlKey && !e.metaKey) {
          const idx = parseInt(e.key) - 1;
          if (idx < this.currentHints.length && (!isInputFocused || inputVal === "")) {
            e.preventDefault();
            this.applyHint(idx);
          }
        } else if (e.altKey && ["1", "2", "3", "4"].includes(e.key)) {
          const idx = parseInt(e.key) - 1;
          if (idx < this.currentHints.length) {
            e.preventDefault();
            this.applyHint(idx);
          }
        }
      }
    });

    // 戰鬥控制鈕
    const btnNewGame = document.getElementById("btn-new-game");
    if (btnNewGame) btnNewGame.addEventListener("click", () => this.startNewBattle());

    const btnSurrender = document.getElementById("btn-surrender");
    if (btnSurrender) btnSurrender.addEventListener("click", () => this.handleSurrender());

    const btnHint = document.getElementById("btn-hint");
    if (btnHint) btnHint.addEventListener("click", () => this.handleHint());

    // 角色與設定
    const selPersona = document.getElementById("select-persona");
    if (selPersona) {
      selPersona.addEventListener("change", (e) => {
        this.currentPersona = e.target.value;
        this.updateHUD();
      });
    }

    const selDiff = document.getElementById("select-diff");
    if (selDiff) {
      selDiff.addEventListener("change", (e) => {
        this.difficulty = e.target.value;
      });
    }

    const chkHomo = document.getElementById("chk-homo");
    if (chkHomo) {
      chkHomo.addEventListener("change", (e) => {
        this.allowHomophone = e.target.checked;
      });
    }

    const chkTone = document.getElementById("chk-strict-tone");
    if (chkTone) {
      chkTone.addEventListener("change", (e) => {
        this.strictTone = e.target.checked;
      });
    }

    const selHomoStyle = document.getElementById("select-homo-style");
    if (selHomoStyle) {
      selHomoStyle.value = this.homoStyle;
      selHomoStyle.addEventListener("change", (e) => {
        this.homoStyle = e.target.value;
        try { localStorage.setItem("wordchain_homo_style", this.homoStyle); } catch {}
        this.refreshHomoCells();
        const label = selHomoStyle.options[selHomoStyle.selectedIndex].text;
        showToast(`同音呈現已切換為：${label}`, "info", 2200);
      });
    }

    const selTime = document.getElementById("select-time-limit");
    if (selTime) {
      selTime.addEventListener("change", (e) => {
        this.timeLimit = parseInt(e.target.value) || 0;
        if (this.hasPlayerStarted) {
          this.startTimer();
        } else {
          this.timerSecondsLeft = this.timeLimit;
          this.updateTimerUI();
        }
      });
    }

    // 演示控制
    const btnStartDemo = document.getElementById("btn-start-demo");
    if (btnStartDemo) btnStartDemo.addEventListener("click", () => this.startDemo());

    const btnDemoFullscreen = document.getElementById("btn-demo-fullscreen");
    if (btnDemoFullscreen) {
      btnDemoFullscreen.addEventListener("click", () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
          btnDemoFullscreen.innerText = "🪟 退出全螢幕";
          if (!this.isDemoRunning) {
            this.startDemo();
          }
          showToast("🖥️ 已進入全螢幕觀戰模式（雙雄字戀屏保中）", "info", 2500);
        } else {
          document.exitFullscreen().catch(() => {});
          btnDemoFullscreen.innerText = "🖥️ 全螢幕觀戰";
        }
      });

      document.addEventListener("fullscreenchange", () => {
        const isFS = !!document.fullscreenElement;
        document.body.classList.toggle("fullscreen-zen", isFS);
        if (btnDemoFullscreen) {
          const fullSpan = btnDemoFullscreen.querySelector(".fs-text-full");
          const shortSpan = btnDemoFullscreen.querySelector(".fs-text-short");
          if (fullSpan && shortSpan) {
            fullSpan.innerText = isFS ? "🪟 退出全螢幕" : "🖥️ 全螢幕觀戰";
            shortSpan.innerText = isFS ? "🪟 退出" : "🖥️ 全螢幕";
          } else {
            btnDemoFullscreen.innerText = isFS ? "🪟 退出全螢幕" : "🖥️ 全螢幕觀戰";
          }
        }
        setTimeout(() => {
          this.recenterViewport(demoBoardViewport, true, false);
        }, 120);
      });

      // 橫轉直 / 直轉橫 (Orientation Change & Viewport Resize) 自動回正視角
      window.addEventListener("resize", () => {
        setTimeout(() => {
          const isDemoActive = document.getElementById("tab-demo")?.classList.contains("active");
          const vp = isDemoActive ? demoBoardViewport : boardViewport;
          this.recenterViewport(vp, isDemoActive, false);
        }, 150);
      });

      window.addEventListener("orientationchange", () => {
        setTimeout(() => {
          const isDemoActive = document.getElementById("tab-demo")?.classList.contains("active");
          const vp = isDemoActive ? demoBoardViewport : boardViewport;
          this.recenterViewport(vp, isDemoActive, false);
        }, 200);
      });
    }

    const btnTakeover = document.getElementById("btn-takeover");
    if (btnTakeover) btnTakeover.addEventListener("click", () => this.takeoverDemo());

    const btnExportDemoLog = document.getElementById("btn-export-demo-log");
    if (btnExportDemoLog) btnExportDemoLog.addEventListener("click", () => this.exportDemoLog());

    // 勝利結算彈窗按鈕
    const btnVicAgain = document.getElementById("btn-vic-again");
    if (btnVicAgain) {
      btnVicAgain.addEventListener("click", () => {
        const modal = document.getElementById("modal-victory");
        if (modal) modal.style.display = "none";
        this.startNewBattle();
      });
    }

    const btnVicShare = document.getElementById("btn-vic-share");
    if (btnVicShare) {
      btnVicShare.addEventListener("click", async () => {
        const rank = document.getElementById("vic-rank-pill")?.innerText || "完美字戀狂";
        const career = this.lastCareer || this.divineCareer();
        let specialStr = "";
        if (this.lastHomoBadge) {
          if (this.lastBadgeType === "pun") {
            specialStr = `🤣 諧音特賞：${this.lastHomoBadge}\n`;
          } else {
            specialStr = `🎵 聲韻特賞：${this.lastHomoBadge}\n`;
          }
        }
        const text = `📜【字戀 (WordChain) 勝戰捷報】\n` +
          `我以「${rank.replace('🏅 榮譽頭銜：', '').trim()}」之姿橫掃文壇，讓大文豪甘拜下風！\n` +
          specialStr +
          `• 累積戰分：${this.playerScore} 分\n` +
          `• 對弈回合：${this.roundCount} 輪\n` +
          `• 終局題目：【${this.battleCurrentWord}】\n` +
          `🔮 職業神算：${career.title}\n` +
          `   （評：${career.desc}）\n` +
          `敢問閣下——您今天字戀了沒？\n` +
          `👉 立即入陣：https://yuktesha.github.io/wordchain/`;

        try {
          // 生成 3.0x 超高解析度 (2400 x 3120 像素) A4 印刷級典雅朱印圖卡
          const canvas = this.generateVictoryCardCanvas(3.0);
          canvas.toBlob(async (blob) => {
            let copiedImage = false;
            if (blob && navigator.clipboard && window.ClipboardItem) {
              try {
                const item = new ClipboardItem({
                  "image/png": blob,
                  "text/plain": new Blob([text], { type: "text/plain" })
                });
                await navigator.clipboard.write([item]);
                copiedImage = true;
                showToast("🎉 4K 超高解析戰報圖卡與文案已複製到剪貼簿！可直接貼於社群分享！", "success", 4000);
                return;
              } catch (clipErr) {
                console.warn("ClipboardItem write failed, fallback to text:", clipErr);
              }
            }

            // 降級備援：複製文字並自動觸發超高解析戰報圖下載存檔
            await navigator.clipboard.writeText(text);
            const a = document.createElement("a");
            a.download = `字戀狂勝戰捷報-4K超高解析-${Date.now()}.png`;
            a.href = canvas.toDataURL("image/png");
            a.click();
            showToast("📋 戰報文字已複製，4K 超高解析圖卡已自動下載儲存！", "success", 4000);
          }, "image/png");
        } catch (e) {
          navigator.clipboard.writeText(text).then(() => {
            showToast("📋 戰報已複製到剪貼簿！快去宣揚閣下的字戀之魂！", "success", 3500);
          }).catch(() => {
            showToast("📋 請手動複製分享戰報！", "info");
          });
        }
      });
    }

    const btnVicPdf = document.getElementById("btn-vic-pdf");
    if (btnVicPdf) {
      btnVicPdf.addEventListener("click", () => {
        this.downloadVictoryPDF();
      });
    }

    const btnVicClose = document.getElementById("btn-vic-close");
    if (btnVicClose) {
      btnVicClose.addEventListener("click", () => {
        const modal = document.getElementById("modal-victory");
        if (modal) modal.style.display = "none";
      });
    }
  }

  // ==========================================
  // 4.1 模式切換管理 (人機對決 vs 雙雄演示 共用單一擂台)
  // ==========================================
  setGameMode(mode) {
    this.gameMode = mode; // 'battle' | 'demo'
    const sel = document.getElementById("select-game-mode");
    if (sel && sel.value !== mode) sel.value = mode;

    // 導航標籤高亮同步
    document.querySelectorAll(".tab-btn").forEach(b => {
      const target = b.getAttribute("data-target");
      if ((mode === "battle" && target === "tab-battle") || (mode === "demo" && target === "tab-demo")) {
        b.classList.add("active");
      } else if (target !== "tab-learned") {
        b.classList.remove("active");
      }
    });

    const humanDock = document.getElementById("input-dock-human");
    const demoDock = document.getElementById("demo-dock-bar");
    const hintBar = document.getElementById("hint-action-bar");
    const personaGroup = document.getElementById("group-persona");

    if (mode === "demo") {
      if (humanDock) humanDock.style.display = "none";
      if (demoDock) demoDock.style.display = "flex";
      if (hintBar) hintBar.style.display = "none";
      if (personaGroup) personaGroup.style.display = "none";
      this.stopTimer();
      if (!this.isDemoRunning) {
        this.startDemo();
      }
    } else {
      if (humanDock) humanDock.style.display = "flex";
      if (demoDock) demoDock.style.display = "none";
      if (personaGroup) personaGroup.style.display = "flex";
      if (this.isDemoRunning) {
        if (this.demoTimer) clearInterval(this.demoTimer);
        this.demoTimer = null;
        this.isDemoRunning = false;
        const btn = document.getElementById("btn-start-demo");
        if (btn) {
          const full = btn.querySelector(".btn-text-full");
          const short = btn.querySelector(".btn-text-short");
          if (full && short) { full.innerText = "開始演示"; short.innerText = "開始"; }
          else { btn.innerText = "開始演示"; }
        }
      }
      const inputEl = document.getElementById("input-word");
      if (inputEl) setTimeout(() => inputEl.focus(), 100);
    }
  }

  // ==========================================
  // 4.5 開場 Splash 與「字戀中……」品牌靈魂系統
  // ==========================================
  initSplash() {
    const splash = document.getElementById("splash-screen");
    if (!splash) return;

    const SPLASH_QUOTES = [
      {
        tag: "🍶 太白醉墨",
        text: "「仰天大笑出門去，我輩豈是蓬蒿人！今日且隨太白，一同字戀三千場！」"
      },
      {
        tag: "🌊 東坡豪邁",
        text: "「大江東去，浪淘盡，千古風流人物！閣下今日可曾字戀至興酣之處？」"
      },
      {
        tag: "🧐 文達雅趣",
        text: "「四庫全書腹中藏，借音取義字字香。文思泉湧，詞海弄潮，您今天字戀了沒？」"
      },
      {
        tag: "⚖️ 鐵面包公",
        text: "「鐵面無私，文心自照！公堂字海對弈，且看閣下今日如何字戀破局！」"
      },
      {
        tag: "✨ 字裡乾坤",
        text: "「同音合璧，雙字成雙；落子天元，字戀無雙。敢問閣下——您今天字戀了沒？」"
      }
    ];

    const pick = SPLASH_QUOTES[Math.floor(Math.random() * SPLASH_QUOTES.length)];
    const tagEl = document.getElementById("splash-quote-tag");
    const textEl = document.getElementById("splash-quote-text");
    if (tagEl) tagEl.innerText = pick.tag;
    if (textEl) textEl.innerText = pick.text;

    const dismiss = () => {
      if (splash.classList.contains("fade-out")) return;
      splash.classList.add("fade-out");
      setTimeout(() => {
        splash.style.display = "none";
        const input = document.getElementById("input-word");
        if (input) input.focus();
      }, 600);
    };

    splash.addEventListener("click", dismiss);
    const btnEnter = document.getElementById("btn-enter-game");
    if (btnEnter) {
      btnEnter.addEventListener("click", (e) => {
        e.stopPropagation();
        dismiss();
      });
    }

    window.addEventListener("keydown", (e) => {
      if (splash.style.display !== "none" && !splash.classList.contains("fade-out")) {
        if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
          dismiss();
        }
      }
    }, { once: true });
  }

  updateRomanceStatus(phase) {
    const playerBadge = document.getElementById("badge-player-status");
    const demoBadge = document.getElementById("badge-demo-status");

    if (phase === "player") {
      if (playerBadge) {
        playerBadge.innerText = "字戀中……";
        playerBadge.style.display = "inline-flex";
      }
      document.title = "《字戀》字戀中…… | WordChain";
    } else if (phase === "ai") {
      if (playerBadge) {
        playerBadge.innerText = "觀戰中";
      }
      document.title = "《字戀》AI 推演中…… | WordChain";
    } else if (phase === "demo_running") {
      if (demoBadge) demoBadge.style.display = "inline-flex";
      document.title = "《字戀》雙雄字戀中…… | WordChain";
    } else if (phase === "demo_stopped") {
      if (demoBadge) demoBadge.style.display = "none";
      document.title = "《字戀》WordChain - 文壇縱橫對弈";
    } else if (phase === "victory") {
      document.title = "👑《字戀》完美字戀狂！| WordChain";
    }
  }

  showVictoryModal(reason = "氣血耗盡") {
    const modal = document.getElementById("modal-victory");
    if (!modal) return;

    const persona = PERSONAS[this.currentPersona] || PERSONAS.ji_xiaolan;
    const rounds = this.roundCount;

    // 統計玩家出招、最長詞格、最速反應與職業星盤分析
    const playerWords = [];
    let bestWord = this.battleCurrentWord;
    let maxLen = this.battleCurrentWord.length;
    let minElapsed = 99.0;
    const rows = document.querySelectorAll("#flow-table-body tr");
    rows.forEach(r => {
      const sp = r.children[1] ? r.children[1].innerText : "";
      const w = r.children[2] ? r.children[2].innerText : "";
      const elText = r.children[4] ? r.children[4].innerText : "";
      if (sp.includes("閣下") && w) {
        playerWords.push(w);
        if (w.length > maxLen) {
          maxLen = w.length;
          bestWord = w;
        }
        const el = parseFloat(elText);
        if (!isNaN(el) && el < minElapsed) minElapsed = el;
      }
    });

    const career = this.divineCareer(playerWords);
    this.lastCareer = career;

    const carTitleEl = document.getElementById("vic-career-title");
    const carDescEl = document.getElementById("vic-career-desc");
    if (carTitleEl) carTitleEl.innerText = career.title;
    if (carDescEl) carDescEl.innerText = career.desc;

    const longestWord = `${bestWord} (${maxLen}字)`;
    const speedStr = (minElapsed < 90) ? `${minElapsed.toFixed(1)}s` : "1.0s";

    let rankTitle = "✨ 雅士 · 風雅字戀客";
    if (this.playerScore >= 1200) rankTitle = "👑 傳奇 · 完美字戀狂";
    else if (this.playerScore >= 800) rankTitle = "🏆 絕代 · 詞宗字戀聖手";
    else if (this.playerScore >= 400) rankTitle = "🏅 傲世 · 一代字戀宗師";

    const subEl = document.getElementById("victory-subtitle");
    if (subEl) {
      subEl.innerText = (reason === "辭窮認輸")
        ? `才高八斗，封死生路；${persona.name} 辭窮認輸！`
        : `滿腹經綸，威震文壇；${persona.name} 氣血耗盡，甘拜下風！`;
    }

    const rEl = document.getElementById("vic-rounds");
    if (rEl) rEl.innerText = rounds;

    const lEl = document.getElementById("vic-longest");
    if (lEl) {
      lEl.title = longestWord;
      if (maxLen >= 6) {
        lEl.style.fontSize = "0.88rem";
      } else {
        lEl.style.fontSize = "";
      }
      lEl.innerHTML = `<span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:95px; display:inline-block; vertical-align:bottom;">${bestWord}</span><span style="font-size:0.75em; opacity:0.85; margin-left:3px; white-space:nowrap;">(${maxLen}字)</span>`;
    }

    const sEl = document.getElementById("vic-speed");
    if (sEl) sEl.innerText = speedStr;

    const scEl = document.getElementById("vic-score");
    if (scEl) scEl.innerText = this.playerScore;

    const pEl = document.getElementById("vic-rank-pill");
    if (pEl) pEl.innerText = `🏅 榮譽頭銜：${rankTitle}`;

    // 結算特賞檢測：精準區分「真正諧音梗 (Pun)」與「聲律借音通押 (Phonetic Rhyme)」
    const homoPill = document.getElementById("vic-homo-pill");
    const exactPunCount = this.playerExactPunCount || 0;
    const punCount = this.playerTruePunCount || 0;
    const phoneticCount = this.playerPhoneticCount || 0;
    const totalPlayerMoves = playerWords.length || 1;
    const phoneticRate = ((phoneticCount / totalPlayerMoves) * 100).toFixed(0);

    let badgeText = "";
    let badgeType = "";

    if (exactPunCount > 0) {
      badgeType = "pun";
      badgeText = `👑🤣 原字諧音宗師 · 雙修破局！(原字諧音 ${exactPunCount} 次 · 妙趣橫生！)`;
    } else if (punCount > 0) {
      badgeType = "pun";
      if (punCount >= 3) {
        badgeText = `🇹🇼 臺灣諧音梗宗師 · 深入骨髓諧音魂！(諧音雙關 ${punCount} 次 · 妙趣橫生！)`;
      } else {
        badgeText = `🤣 臺灣諧音梗達人 · 雙關妙語連珠！(諧音雙關 ${punCount} 次)`;
      }
    } else if (phoneticCount > 0) {
      badgeType = "rhyme";
      if (phoneticCount >= 5 || (phoneticCount >= 2 && phoneticCount / totalPlayerMoves >= 0.4)) {
        badgeText = `🎵 聲律宗師 · 借音無礙！(借音出招 ${phoneticCount} 次 · 佔比 ${phoneticRate}%)`;
      } else if (phoneticCount >= 2) {
        badgeText = `🎶 聲韻大家 · 翻宮轉調！(借音出招 ${phoneticCount} 次)`;
      } else {
        badgeText = `✨ 宮商相和 · 借音入局！(借音出招 1 次)`;
      }
    }

    if (homoPill) {
      if (badgeText) {
        homoPill.innerText = badgeText;
        homoPill.className = (badgeType === "pun") ? "victory-homo-pill" : "victory-rhyme-pill";
        homoPill.style.display = "inline-flex";
      } else {
        homoPill.style.display = "none";
      }
    }

    this.lastBestWord = bestWord;
    this.lastBestLen = maxLen;
    this.lastLongestWord = longestWord;
    this.lastSpeedStr = speedStr;
    this.lastRankTitle = rankTitle;
    this.lastHomoBadge = badgeText;
    this.lastBadgeType = badgeType;

    modal.style.display = "flex";
    this.updateRomanceStatus("victory");
  }

  // ==========================================
  // 4.1 生成戰報圖卡 (Canvas 2D 超高解析 2400x3120 A4 印刷級典雅朱印證書 PNG)
  // ==========================================
  generateVictoryCardCanvas(scale = 3.0) {
    const baseW = 800;
    const baseH = 1040;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(baseW * scale);
    canvas.height = Math.round(baseH * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;

    // 所有座標以 800x1040 向量基準等比放大
    ctx.scale(scale, scale);

    const width = baseW;
    const height = baseH;

    const drawRoundRect = (x, y, w, h, r) => {
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, w, h, r);
      } else {
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
      }
    };

    // 1. 背景漸層
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#121722");
    bgGrad.addColorStop(0.5, "#182030");
    bgGrad.addColorStop(1, "#0a0d14");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. 幾何金色棋盤網格底紋
    ctx.strokeStyle = "rgba(241, 196, 15, 0.04)";
    ctx.lineWidth = 1;
    const step = 40;
    for (let x = 0; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 3. 雙層金邊裝飾框
    ctx.strokeStyle = "#f1c40f";
    ctx.lineWidth = 4;
    ctx.strokeRect(28, 28, width - 56, height - 56);

    ctx.strokeStyle = "rgba(241, 196, 15, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(36, 36, width - 72, height - 72);

    // 四角典雅回紋
    const drawCorner = (cx, cy, dirX, dirY) => {
      ctx.strokeStyle = "#f1c40f";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx + dirX * 24, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + dirY * 24);
      ctx.stroke();
    };
    drawCorner(44, 44, 1, 1);
    drawCorner(width - 44, 44, -1, 1);
    drawCorner(44, height - 44, 1, -1);
    drawCorner(width - 44, height - 44, -1, -1);

    // 4. 右上角朱紅斜角官印：「字戀狂認證」
    ctx.save();
    ctx.translate(width - 130, 95);
    ctx.rotate(12 * Math.PI / 180);
    ctx.fillStyle = "rgba(192, 57, 43, 0.9)";
    ctx.fillRect(-65, -22, 130, 44);
    ctx.strokeStyle = "#e74c3c";
    ctx.lineWidth = 3;
    ctx.strokeRect(-61, -18, 122, 36);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px 'Noto Serif TC', serif, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("字 戀 狂 認 證", 0, 0);
    ctx.restore();

    // 5. 頂部皇冠與大標題
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "56px 'Segoe UI Emoji', sans-serif";
    ctx.fillText("👑", width / 2, 120);

    ctx.font = "900 46px 'Noto Serif TC', serif, sans-serif";
    ctx.fillStyle = "#f1c40f";
    ctx.shadowColor = "rgba(241, 196, 15, 0.6)";
    ctx.shadowBlur = 18;
    ctx.fillText("您這個完美字戀狂！", width / 2, 195);
    ctx.shadowBlur = 0;

    const persona = PERSONAS[this.currentPersona] || PERSONAS.ji_xiaolan;
    ctx.font = "500 20px 'Noto Sans TC', sans-serif";
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(`滿腹經綸，威震文壇；${persona.name} 氣血耗盡，甘拜下風！`, width / 2, 250);

    // 6. 戰績儀表盒 (4 欄統計)
    const boxX = 60;
    const boxY = 295;
    const boxW = width - 120;
    const boxH = 150;

    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    const statsCols = [
      { lbl: "對弈回合", val: `${this.roundCount} 輪` },
      { lbl: "最長詞格", val: this.lastLongestWord || `${this.battleCurrentWord} (4字)` },
      { lbl: "極速出招", val: this.lastSpeedStr || "1.0s" },
      { lbl: "累積戰分", val: `${this.playerScore} 分` }
    ];

    const colW = boxW / 4;
    statsCols.forEach((col, idx) => {
      const cx = boxX + colW * idx + colW / 2;
      ctx.font = "500 16px 'Noto Sans TC', sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(col.lbl, cx, boxY + 45);

      if (idx === 1) {
        const bw = this.lastBestWord || (this.battleCurrentWord || "四字成語");
        const blen = this.lastBestLen || bw.length;
        let wordDisplay = bw;
        let wordFontSize = 22;
        if (blen > 10) {
          wordFontSize = 12;
          if (wordDisplay.length > 12) wordDisplay = wordDisplay.slice(0, 11) + '…';
        } else if (blen >= 8) wordFontSize = 13;
        else if (blen >= 6) wordFontSize = 15;
        else if (blen >= 5) wordFontSize = 17;

        if (blen >= 5) {
          ctx.font = `bold ${wordFontSize}px 'Noto Sans TC', sans-serif`;
          ctx.fillStyle = "#00cec9";
          ctx.fillText(wordDisplay, cx, boxY + 78);

          ctx.font = "bold 13px 'Noto Sans TC', sans-serif";
          ctx.fillStyle = "#67e8f9";
          ctx.fillText(`(${blen}字)`, cx, boxY + 105);
        } else {
          ctx.font = "bold 18px 'Noto Sans TC', sans-serif";
          ctx.fillStyle = "#00cec9";
          ctx.fillText(`${wordDisplay} (${blen}字)`, cx, boxY + 95);
        }
      } else {
        ctx.font = "bold 24px 'Noto Sans TC', sans-serif";
        ctx.fillStyle = "#00cec9";
        ctx.fillText(col.val, cx, boxY + 95);
      }

      if (idx < 3) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.beginPath();
        ctx.moveTo(boxX + colW * (idx + 1), boxY + 25);
        ctx.lineTo(boxX + colW * (idx + 1), boxY + boxH - 25);
        ctx.stroke();
      }
    });

    // 7. 榮譽頭銜膠囊
    const rankY = 475;
    const rankW = 440;
    const rankH = 44;
    const rankX = (width - rankW) / 2;

    ctx.fillStyle = "rgba(241, 196, 15, 0.15)";
    ctx.strokeStyle = "rgba(241, 196, 15, 0.5)";
    ctx.lineWidth = 1.5;
    drawRoundRect(rankX, rankY, rankW, rankH, 22);
    ctx.fill();
    ctx.stroke();

    const rankTitle = this.lastRankTitle || "👑 傳奇 · 完美字戀狂";
    ctx.font = "bold 20px 'Noto Sans TC', sans-serif";
    ctx.fillStyle = "#f1c40f";
    ctx.fillText(`🏅 榮譽頭銜：${rankTitle}`, width / 2, rankY + rankH / 2);

    // 7.05 特賞膠囊 (諧音雙關梗 / 聲律通押)
    let homoShift = 0;
    if (this.lastHomoBadge) {
      homoShift = 42;
      const homoY = 525;
      const homoW = 540;
      const homoH = 34;
      const homoX = (width - homoW) / 2;

      const isPun = (this.lastBadgeType === "pun");
      const pillColor = isPun ? "#2ed573" : "#00cec9";
      const pillBg = isPun ? "rgba(46, 213, 115, 0.16)" : "rgba(0, 206, 201, 0.16)";
      const pillBorder = isPun ? "rgba(46, 213, 115, 0.55)" : "rgba(0, 206, 201, 0.55)";

      ctx.fillStyle = pillBg;
      ctx.strokeStyle = pillBorder;
      ctx.lineWidth = 1.2;
      drawRoundRect(homoX, homoY, homoW, homoH, 17);
      ctx.fill();
      ctx.stroke();

      ctx.font = "bold 15px 'Noto Sans TC', sans-serif";
      ctx.fillStyle = pillColor;
      ctx.fillText(this.lastHomoBadge, width / 2, homoY + homoH / 2);
    }

    // 7.1 詞海八字 · 職業神算卡
    const carY = 545 + (homoShift ? 25 : 0);
    const carW = width - 140;
    const carH = homoShift ? 100 : 110;
    const carX = 70;

    const carGrad = ctx.createLinearGradient(carX, carY, carX + carW, carY + carH);
    carGrad.addColorStop(0, "rgba(230, 126, 34, 0.15)");
    carGrad.addColorStop(1, "rgba(243, 156, 18, 0.08)");
    ctx.fillStyle = carGrad;
    ctx.strokeStyle = "rgba(230, 126, 34, 0.4)";
    ctx.lineWidth = 1.2;
    drawRoundRect(carX, carY, carW, carH, 12);
    ctx.fill();
    ctx.stroke();

    const carTitle = this.lastCareer ? this.lastCareer.title : "【跨界大斜槓奇才】";
    const carDesc = this.lastCareer ? this.lastCareer.desc : "您該不會是各界深藏不露的隱世掃地僧吧？";

    ctx.font = "bold 13px 'Noto Sans TC', sans-serif";
    ctx.fillStyle = "#e67e22";
    ctx.fillText("🔮 詞海八字 · 職業神算推測", width / 2, carY + 26);

    ctx.font = "bold 20px 'Noto Serif TC', serif";
    ctx.fillStyle = "#f39c12";
    ctx.fillText(carTitle, width / 2, carY + 56);

    ctx.font = "15px 'Noto Sans TC', sans-serif";
    ctx.fillStyle = "#f1f5f9";
    ctx.fillText(`「${carDesc}」`, width / 2, carY + 86);

    // 8. 終局之題與名句卡
    const quoteY = 675;
    const quoteW = width - 140;
    const quoteH = 135;
    const quoteX = 70;

    ctx.fillStyle = "rgba(18, 24, 38, 0.85)";
    ctx.strokeStyle = "rgba(0, 206, 201, 0.35)";
    ctx.lineWidth = 1.2;
    drawRoundRect(quoteX, quoteY, quoteW, quoteH, 12);
    ctx.fill();
    ctx.stroke();

    ctx.font = "bold 17px 'Noto Sans TC', sans-serif";
    ctx.fillStyle = "#00cec9";
    ctx.fillText(`🚩 終局題目：【${this.battleCurrentWord}】`, width / 2, quoteY + 42);

    ctx.font = "italic 20px 'Noto Serif TC', serif";
    ctx.fillStyle = "#f1f5f9";
    ctx.fillText("「文思泉湧，詞海弄潮！敢問閣下——您今天字戀了沒？」", width / 2, quoteY + 88);

    // 9. 底部官方網址與印記
    ctx.font = "500 16px 'Noto Sans TC', sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText("臺灣教育部重編國語辭典 · 中華文采字陣對弈雅苑", width / 2, 850);

    ctx.font = "bold 19px monospace, sans-serif";
    ctx.fillStyle = "#f1c40f";
    ctx.fillText("https://yuktesha.github.io/wordchain/", width / 2, 885);

    ctx.font = "14px 'Noto Sans TC', sans-serif";
    ctx.fillStyle = "#475569";
    ctx.fillText(`戰報產出時間：${new Date().toLocaleDateString('zh-TW')} · 獨家傳世授權認證`, width / 2, 935);

    return canvas;
  }

  // ==========================================
  // 4.2 生成全向量 SVG 證書 (可無限縮放放大至整面牆壁印刷)
  // ==========================================
  generateVictoryCardSVG() {
    const width = 800;
    const height = 1040;
    const persona = PERSONAS[this.currentPersona] || PERSONAS.ji_xiaolan;
    const rankTitle = this.lastRankTitle || "👑 傳奇 · 完美字戀狂";
    const carTitle = this.lastCareer ? this.lastCareer.title : "【跨界大斜槓奇才】";
    const carDesc = this.lastCareer ? this.lastCareer.desc : "您該不會是各界深藏不露的隱世掃地僧吧？";
    const bw = this.lastBestWord || (this.battleCurrentWord || "四字成語");
    const blen = this.lastBestLen || bw.length;
    let wordDisplay = bw;
    let wordFontSize = 22;
    if (blen > 10) {
      wordFontSize = 12;
      if (wordDisplay.length > 12) wordDisplay = wordDisplay.slice(0, 11) + '…';
    } else if (blen >= 8) wordFontSize = 13;
    else if (blen >= 6) wordFontSize = 15;
    else if (blen >= 5) wordFontSize = 17;
    const speedStr = this.lastSpeedStr || "1.0s";
    const dateStr = new Date().toLocaleDateString('zh-TW');

    let gridLines = "";
    for (let x = 0; x < width; x += 40) {
      gridLines += `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="#f1c40f" stroke-opacity="0.04" stroke-width="1"/>`;
    }
    for (let y = 0; y < height; y += 40) {
      gridLines += `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#f1c40f" stroke-opacity="0.04" stroke-width="1"/>`;
    }

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#121722"/>
      <stop offset="50%" stop-color="#182030"/>
      <stop offset="100%" stop-color="#0a0d14"/>
    </linearGradient>
    <linearGradient id="carGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e67e22" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#f39c12" stop-opacity="0.08"/>
    </linearGradient>
    <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- 背景與金色網格底紋 -->
  <rect width="${width}" height="${height}" fill="url(#bgGrad)"/>
  ${gridLines}

  <!-- 雙層金邊外框 -->
  <rect x="28" y="28" width="${width - 56}" height="${height - 56}" fill="none" stroke="#f1c40f" stroke-width="4"/>
  <rect x="36" y="36" width="${width - 72}" height="${height - 72}" fill="none" stroke="#f1c40f" stroke-opacity="0.4" stroke-width="1.5"/>

  <!-- 四角回紋裝飾 -->
  <path d="M 68 44 L 44 44 L 44 68" fill="none" stroke="#f1c40f" stroke-width="2.5"/>
  <path d="M ${width - 68} 44 L ${width - 44} 44 L ${width - 44} 68" fill="none" stroke="#f1c40f" stroke-width="2.5"/>
  <path d="M 68 ${height - 44} L 44 ${height - 44} L 44 ${height - 68}" fill="none" stroke="#f1c40f" stroke-width="2.5"/>
  <path d="M ${width - 68} ${height - 44} L ${width - 44} ${height - 44} L ${width - 44} ${height - 68}" fill="none" stroke="#f1c40f" stroke-width="2.5"/>

  <!-- 右上角朱紅官印 -->
  <g transform="translate(${width - 130}, 95) rotate(12)">
    <rect x="-65" y="-22" width="130" height="44" fill="#c0392b" fill-opacity="0.9"/>
    <rect x="-61" y="-18" width="122" height="36" fill="none" stroke="#e74c3c" stroke-width="3"/>
    <text x="0" y="5" font-family="'Noto Serif TC', serif" font-weight="bold" font-size="18" fill="#ffffff" text-anchor="middle">字 戀 狂 認 證</text>
  </g>

  <!-- 頂部皇冠與大標題 -->
  <text x="${width / 2}" y="130" font-size="56" text-anchor="middle">👑</text>
  <text x="${width / 2}" y="195" font-family="'Noto Serif TC', serif" font-weight="900" font-size="46" fill="#f1c40f" text-anchor="middle" filter="url(#goldGlow)">您這個完美字戀狂！</text>
  <text x="${width / 2}" y="250" font-family="'Noto Sans TC', sans-serif" font-weight="500" font-size="20" fill="#cbd5e1" text-anchor="middle">滿腹經綸，威震文壇；${persona.name} 氣血耗盡，甘拜下風！</text>

  <!-- 戰績儀表盒 -->
  <g transform="translate(60, 295)">
    <rect width="${width - 120}" height="150" fill="#000000" fill-opacity="0.45" stroke="#ffffff" stroke-opacity="0.12" stroke-width="1"/>
    <!-- 4 欄數據 -->
    <text x="85" y="45" font-family="'Noto Sans TC', sans-serif" font-size="16" fill="#94a3b8" text-anchor="middle">對弈回合</text>
    <text x="85" y="95" font-family="'Noto Sans TC', sans-serif" font-weight="bold" font-size="24" fill="#00cec9" text-anchor="middle">${this.roundCount} 輪</text>
    <line x1="170" y1="25" x2="170" y2="125" stroke="#ffffff" stroke-opacity="0.08"/>

    <text x="255" y="45" font-family="'Noto Sans TC', sans-serif" font-size="16" fill="#94a3b8" text-anchor="middle">最長詞格</text>
    ${blen >= 5 ? `
      <text x="255" y="78" font-family="'Noto Sans TC', sans-serif" font-weight="bold" font-size="${wordFontSize}" fill="#00cec9" text-anchor="middle">${wordDisplay}</text>
      <text x="255" y="105" font-family="'Noto Sans TC', sans-serif" font-weight="500" font-size="13" fill="#67e8f9" text-anchor="middle">(${blen}字)</text>
    ` : `
      <text x="255" y="95" font-family="'Noto Sans TC', sans-serif" font-weight="bold" font-size="18" fill="#00cec9" text-anchor="middle">${wordDisplay} (${blen}字)</text>
    `}
    <line x1="340" y1="25" x2="340" y2="125" stroke="#ffffff" stroke-opacity="0.08"/>

    <text x="425" y="45" font-family="'Noto Sans TC', sans-serif" font-size="16" fill="#94a3b8" text-anchor="middle">極速出招</text>
    <text x="425" y="95" font-family="'Noto Sans TC', sans-serif" font-weight="bold" font-size="24" fill="#00cec9" text-anchor="middle">${speedStr}</text>
    <line x1="510" y1="25" x2="510" y2="125" stroke="#ffffff" stroke-opacity="0.08"/>

    <text x="595" y="45" font-family="'Noto Sans TC', sans-serif" font-size="16" fill="#94a3b8" text-anchor="middle">累積戰分</text>
    <text x="595" y="95" font-family="'Noto Sans TC', sans-serif" font-weight="bold" font-size="24" fill="#00cec9" text-anchor="middle">${this.playerScore} 分</text>
  </g>

  <!-- 榮譽頭銜膠囊 -->
  <g transform="translate(${(width - 440) / 2}, 475)">
    <rect width="440" height="44" rx="22" fill="#f1c40f" fill-opacity="0.15" stroke="#f1c40f" stroke-opacity="0.5" stroke-width="1.5"/>
    <text x="220" y="28" font-family="'Noto Sans TC', sans-serif" font-weight="bold" font-size="20" fill="#f1c40f" text-anchor="middle">🏅 榮譽頭銜：${rankTitle}</text>
  </g>

  ${this.lastHomoBadge ? `
  <!-- 特賞膠囊 (諧音雙關梗 / 聲律通押) -->
  <g transform="translate(${(width - 540) / 2}, 525)">
    <rect width="540" height="34" rx="17" fill="${this.lastBadgeType === 'pun' ? '#2ed573' : '#00cec9'}" fill-opacity="0.16" stroke="${this.lastBadgeType === 'pun' ? '#2ed573' : '#00cec9'}" stroke-opacity="0.55" stroke-width="1.2"/>
    <text x="270" y="22" font-family="'Noto Sans TC', sans-serif" font-weight="bold" font-size="14" fill="${this.lastBadgeType === 'pun' ? '#2ed573' : '#00cec9'}" text-anchor="middle">${this.lastHomoBadge}</text>
  </g>` : ''}

  <!-- 🔮 詞海八字 · 職業神算卡 -->
  <g transform="translate(70, ${this.lastHomoBadge ? 570 : 545})">
    <rect width="${width - 140}" height="${this.lastHomoBadge ? 100 : 110}" rx="12" fill="url(#carGrad)" stroke="#e67e22" stroke-opacity="0.4" stroke-width="1.2"/>
    <text x="${(width - 140) / 2}" y="26" font-family="'Noto Sans TC', sans-serif" font-weight="bold" font-size="13" fill="#e67e22" text-anchor="middle">🔮 詞海八字 · 職業神算推測</text>
    <text x="${(width - 140) / 2}" y="56" font-family="'Noto Serif TC', serif" font-weight="bold" font-size="20" fill="#f39c12" text-anchor="middle">${carTitle}</text>
    <text x="${(width - 140) / 2}" y="84" font-family="'Noto Sans TC', sans-serif" font-size="14" fill="#f1f5f9" text-anchor="middle">「${carDesc}」</text>
  </g>

  <!-- 終局之題與名句卡 -->
  <g transform="translate(70, 675)">
    <rect width="${width - 140}" height="135" rx="12" fill="#121826" fill-opacity="0.85" stroke="#00cec9" stroke-opacity="0.35" stroke-width="1.2"/>
    <text x="${(width - 140) / 2}" y="42" font-family="'Noto Sans TC', sans-serif" font-weight="bold" font-size="17" fill="#00cec9" text-anchor="middle">🚩 終局題目：【${this.battleCurrentWord}】</text>
    <text x="${(width - 140) / 2}" y="88" font-family="'Noto Serif TC', serif" font-style="italic" font-size="20" fill="#f1f5f9" text-anchor="middle">「文思泉湧，詞海弄潮！敢問閣下——您今天字戀了沒？」</text>
  </g>

  <!-- 底部官方網址與印記 -->
  <text x="${width / 2}" y="850" font-family="'Noto Sans TC', sans-serif" font-weight="500" font-size="16" fill="#64748b" text-anchor="middle">臺灣教育部重編國語辭典 · 中華文采字陣對弈雅苑</text>
  <text x="${width / 2}" y="885" font-family="monospace, sans-serif" font-weight="bold" font-size="19" fill="#f1c40f" text-anchor="middle">https://yuktesha.github.io/wordchain/</text>
  <text x="${width / 2}" y="935" font-family="'Noto Sans TC', sans-serif" font-size="14" fill="#475569" text-anchor="middle">戰報產出時間：${dateStr} · 獨家傳世授權認證</text>
</svg>`;
    return svg;
  }

  // ==========================================
  // 4.3 下載全向量證書與高解析列印 / 存為 PDF
  // ==========================================
  downloadVictoryPDF() {
    const svgContent = this.generateVictoryCardSVG();
    const rank = (this.lastRankTitle || "完美字戀狂").replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");
    const fileName = `字戀狂勝戰證書-${rank}-${Date.now()}`;

    // 1. 自動觸發全向量 SVG 下載（可於 Illustrator, CorelDRAW, Inkscape 或瀏覽器無限放大列印）
    const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);

    // 2. 自動開啟獨立純淨列印視窗，呼叫 window.print() 供使用者直接「存為 PDF」或實體 A4/A3 列印
    const printWin = window.open("", "_blank");
    if (printWin) {
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${fileName} - 典雅朱印戰報證書</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 0;
            }
            html, body {
              margin: 0;
              padding: 0;
              width: 100vw;
              height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #0a0d14;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            svg {
              width: 100%;
              height: 100%;
              max-height: 100vh;
              display: block;
            }
            @media print {
              body { background: #0a0d14 !important; }
            }
          </style>
        </head>
        <body>
          ${svgContent}
          <script>
            window.addEventListener('load', () => {
              setTimeout(() => {
                window.print();
              }, 400);
            });
          <\/script>
        </body>
        </html>
      `);
      printWin.document.close();
    }

    showToast("🎉 已下載全向量證書 (SVG) 並開啟 A4 列印/另存 PDF 視窗！", "success", 4500);
  }

  // ==========================================
  // 5. 戰鬥儀表與計時器 (HUD & Timer)
  // ==========================================
  updateHUD() {
    const pScoreEl = document.getElementById("lbl-player-score");
    const aiScoreEl = document.getElementById("lbl-ai-score");
    const pBar = document.getElementById("bar-player-hp");
    const aiBar = document.getElementById("bar-ai-hp");
    const persona = PERSONAS[this.currentPersona] || PERSONAS.ji_xiaolan;
    const maxHp = this.maxHp || 1000;

    if (pScoreEl) pScoreEl.innerText = `👤 閣下: ${this.playerHp} / ${maxHp} HP | 積分: ${this.playerScore}`;
    if (aiScoreEl) aiScoreEl.innerText = `${persona.icon} ${persona.name}: ${this.aiHp} / ${maxHp} HP | 積分: ${this.aiScore}`;
    if (pBar) pBar.style.width = `${Math.max(0, Math.min(100, (this.playerHp / maxHp) * 100)).toFixed(1)}%`;
    if (aiBar) aiBar.style.width = `${Math.max(0, Math.min(100, (this.aiHp / maxHp) * 100)).toFixed(1)}%`;
  }

  startTimer() {
    this.stopTimer();
    if (this.timeLimit <= 0) {
      const lbl = document.getElementById("lbl-timer");
      if (lbl) { lbl.innerText = "⏱️ --"; lbl.style.color = "#888"; }
      const bar = document.getElementById("bar-timer");
      if (bar) bar.style.width = "100%";
      return;
    }
    this.timerSecondsLeft = this.timeLimit;
    this.turnStartTime = Date.now();
    this.updateTimerUI();
    this.timerId = setInterval(() => this.tickTimer(), 1000);
  }

  stopTimer() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  tickTimer() {
    this.timerSecondsLeft--;
    this.updateTimerUI();
    if (this.timerSecondsLeft <= 0) {
      this.onTimeout();
    }
  }

  updateTimerUI() {
    const left = Math.max(0, this.timerSecondsLeft);
    const lbl = document.getElementById("lbl-timer");
    const bar = document.getElementById("bar-timer");
    if (lbl) {
      if (!this.hasPlayerStarted) {
        lbl.innerText = (this.timeLimit > 0) ? `⏱️ ${this.timeLimit}s (等候首招)` : `⏱️ (等候首招)`;
        lbl.style.color = "var(--accent-gold, #f1c40f)";
      } else {
        lbl.innerText = `⏱️ ${left}s`;
        lbl.style.color = (left <= 5) ? "#ff4757" : (left <= 10) ? "#ffa502" : "#2ed573";
      }
    }
    if (bar && this.timeLimit > 0) {
      if (!this.hasPlayerStarted) {
        bar.style.width = "100%";
        bar.style.backgroundColor = "var(--accent-gold, #f1c40f)";
      } else {
        bar.style.width = `${(left / this.timeLimit) * 100}%`;
        bar.style.backgroundColor = (left <= 5) ? "#ff4757" : (left <= 10) ? "#ffa502" : "#2ed573";
      }
    }
  }

  onTimeout() {
    this.stopTimer();
    this.playerScore = Math.max(0, this.playerScore - 30);
    this.playerHp = Math.max(0, this.playerHp - 50);
    this.updateHUD();

    showToast("答題超時！自損 50 HP，扣除 30 積分！軍師強行接管！", "warning");

    if (this.playerHp <= 0) {
      showToast("💀 氣血耗盡，閣下落敗！", "error");
      return;
    }

    const tail = getTailChar(this.battleCurrentWord);
    const entries = this.getScoredEntries(tail, this.allowHomophone, false, this.battleCurrentWord);
    if (entries.length > 0) {
      const bail = entries[0][0];
      this.battleUsedWords.add(bail);
      this.battleCurrentWord = bail;
      this.roundCount++;

      this.placeWordOnBoard(bail, "player", `時間緊迫，軍師出招【${bail}】保命！`, true);
      this.appendFlowTableRow(this.roundCount, "👤 軍師急救", bail, "超時保命", 30.0, 10);
      this.updateTargetCard(bail);
      this.updateStoryCard(bail);

      setTimeout(() => this.aiTurn(), 700);
    } else {
      this.handleSurrender();
    }
  }

  // ==========================================
  // 6. 新局開賽與棋盤初始化 (Start New Battle)
  // ==========================================
  startNewBattle() {
    const starters = ["天馬行空", "開門見山", "海闊天空", "龍飛鳳舞", "萬象更新", "心曠神怡", "乘風破浪", "浩然正氣"];
    this.battleCurrentWord = starters[Math.floor(Math.random() * starters.length)];
    this.battleUsedWords = new Set([this.battleCurrentWord]);
    this.roundCount = 1;

    // 重置氣血與積分 (1000 HP 長局纏鬥)
    this.maxHp = 1000;
    this.playerHp = 1000;
    this.aiHp = 1000;
    this.playerScore = 0;
    this.aiScore = 0;
    this.playerPhoneticCount = 0;
    this.playerPhoneticCombo = 0;
    this.playerExactCount = 0;
    this.playerExactCombo = 0;
    this.playerTruePunCount = 0;
    this.playerExactPunCount = 0;
    this.playerPunWords = [];
    this.playerHomophoneCount = 0;
    this.playerHomophoneCombo = 0;
    this.lastHomoBadge = "";
    this.lastBadgeType = "";
    this.lastBestWord = "";
    this.lastBestLen = 0;
    this.updateHUD();

    // 清空棋盤與表格
    this.boardMap.clear();
    const grid = document.getElementById("cross-board-grid");
    if (grid) grid.innerHTML = "";
    const flowTbody = document.getElementById("flow-table-body");
    if (flowTbody) flowTbody.innerHTML = "";

    this.lastTailCoord = { row: 1, col: 1 };
    this.lastDirection = 'horizontal';
    this.minRow = 1;
    this.maxRow = 1;
    this.minCol = 1;
    this.maxCol = 1;

    // 放置題目詞 (立題)
    this.placeWordOnBoard(this.battleCurrentWord, "system", `先手立題【${this.battleCurrentWord}】，請閣下出招！`, false, true);
    this.appendFlowTableRow(1, "🚩 系統立題", this.battleCurrentWord, "初始陣勢", 0.0, 0);

    this.updateTargetCard(this.battleCurrentWord);
    const persona = PERSONAS[this.currentPersona] || PERSONAS.ji_xiaolan;
    const personaDict = DIALOGUE_MATRIX[this.currentPersona] || DIALOGUE_MATRIX["ji_xiaolan"];
    const openingMsg = (personaDict.opening && personaDict.opening.length)
      ? personaDict.opening[Math.floor(Math.random() * personaDict.opening.length)]
      : `請閣下先出招，敢問閣下——您今天字戀了沒？`;

    this.updateLiveBanter(persona.icon, `${persona.name}：${openingMsg}`);
    this.updateScorerCard(1, "🚩 系統立題", this.battleCurrentWord, "開局立題", "0.0s", `${this.battleCurrentWord.length}字`, "🟢初始陣勢", "等待選手接龍走棋", 0, 0);

    this.clearHintBar();
    this.hasPlayerStarted = false;
    this.stopTimer();
    this.timerSecondsLeft = this.timeLimit;
    this.updateTimerUI();
    this.updateRomanceStatus("player");
    showToast(`新局就緒！立題【${this.battleCurrentWord}】，等候閣下首招接龍（落子後正式起鐘計時）！`, "info", 4500);
  }

  // ==========================================
  // 6.5 氣泡空間避障演算法 (Bubble Collision Avoidance)
  // 確保氣泡絕不遮擋棋盤上任何已落子的漢字格
  // ==========================================
  findClearBubblePosition(boardMap, placedCoords, isEvenRound, direction) {
    const wordMinRow = Math.min(...placedCoords.map(p => p.row));
    const wordMaxRow = Math.max(...placedCoords.map(p => p.row));
    const wordMinCol = Math.min(...placedCoords.map(p => p.col));
    const wordMaxCol = Math.max(...placedCoords.map(p => p.col));
    const midRow = Math.round((wordMinRow + wordMaxRow) / 2);
    const midCol = Math.round((wordMinCol + wordMaxCol) / 2);

    const bWidth = 210;
    const bHeight = 52;

    // 候選 1: 右側 (箭頭朝左指回字格)
    const candRight = {
      arrowClass: 'arrow-left',
      bLeft: (wordMaxCol + 1) * 44 + 10,
      bTop: Math.max(10, midRow * 44 + 10),
      c1: wordMaxCol + 1,
      c2: Math.floor(((wordMaxCol + 1) * 44 + 10 + bWidth - 1) / 44),
      r1: Math.floor(Math.max(10, midRow * 44 + 10) / 44),
      r2: Math.floor((Math.max(10, midRow * 44 + 10) + bHeight - 1) / 44)
    };

    // 候選 2: 左側 (箭頭朝右指回字格)
    const candLeft = {
      arrowClass: 'arrow-right',
      bLeft: wordMinCol * 44 - bWidth - 10,
      bTop: Math.max(10, midRow * 44 + 10),
      c1: Math.floor((wordMinCol * 44 - bWidth - 10) / 44),
      c2: wordMinCol - 1,
      r1: Math.floor(Math.max(10, midRow * 44 + 10) / 44),
      r2: Math.floor((Math.max(10, midRow * 44 + 10) + bHeight - 1) / 44)
    };

    // 候選 3: 下方 (箭頭朝上指回字格)
    const bLeftBelow = Math.max(10, midCol * 44 - 2);
    const candBelow = {
      arrowClass: 'arrow-up',
      bLeft: bLeftBelow,
      bTop: (wordMaxRow + 1) * 44 + 10,
      c1: Math.floor(bLeftBelow / 44),
      c2: Math.floor((bLeftBelow + bWidth - 1) / 44),
      r1: wordMaxRow + 1,
      r2: Math.floor(((wordMaxRow + 1) * 44 + 10 + bHeight - 1) / 44)
    };

    // 候選 4: 上方 (箭頭朝下指回字格)
    const bLeftAbove = Math.max(10, midCol * 44 - 2);
    const candAbove = {
      arrowClass: 'arrow-down',
      bLeft: bLeftAbove,
      bTop: wordMinRow * 44 - bHeight - 10,
      c1: Math.floor(bLeftAbove / 44),
      c2: Math.floor((bLeftAbove + bWidth - 1) / 44),
      r1: Math.floor((wordMinRow * 44 - bHeight - 10) / 44),
      r2: wordMinRow - 1
    };

    // 依當前字詞走向與輪次奇偶，設定偏好次序以達成交替美感
    const cands = (direction === 'vertical')
      ? (isEvenRound ? [candRight, candLeft, candBelow, candAbove] : [candLeft, candRight, candBelow, candAbove])
      : (isEvenRound ? [candBelow, candAbove, candRight, candLeft] : [candAbove, candBelow, candRight, candLeft]);

    let best = null;
    let minColls = 9999;

    for (const c of cands) {
      if (c.bLeft < 10 || c.bTop < 10) continue;
      let collisions = 0;
      for (let r = c.r1; r <= c.r2; r++) {
        for (let col = c.c1; col <= c.c2; col++) {
          if (boardMap.has(`${r},${col}`)) collisions++;
        }
      }
      if (collisions === 0) return c; // 零碰撞完美避障！
      if (collisions < minColls) {
        minColls = collisions;
        best = c;
      }
    }
    return best || (candRight.bLeft >= 10 ? candRight : candBelow);
  }

  // ==========================================
  // 7. 二維縱橫字陣棋盤引擎 (CrossBoardGrid Engine)
  // ==========================================
  placeWordOnBoard(word, speakerType, banterText, isPlayer = false, isInitial = false, isDemo = false) {
    const gridId = isDemo ? "demo-board-grid" : "cross-board-grid";
    const viewportId = isDemo ? "demo-board-viewport" : "cross-board-viewport";
    const cellPrefix = isDemo ? "demo-cell-" : "cell-";

    const grid = document.getElementById(gridId);
    if (!grid) return;

    const boardMap = isDemo ? this.demoBoardMap : this.boardMap;
    const chars = word.split("");
    const L = chars.length;
    const placedCoords = [];

    if (isInitial) {
      // 初始詞：從 (1, 1) 橫向排開，精準適配各裝置左上視野 (留 44px 安全緩衝)
      const startRow = 1;
      const startCol = 1;
      for (let i = 0; i < L; i++) {
        const r = startRow;
        const c = startCol + i;
        const ch = chars[i];
        const zh = getCharZhuyin(ch);
        boardMap.set(`${r},${c}`, { char: ch, speaker: speakerType, zhuyin: zh, isPivot: false, word: word });
        placedCoords.push({ row: r, col: c, char: ch, isPivot: false });
      }
      if (isDemo) {
        this.demoLastTailCoord = { row: startRow, col: startCol + L - 1 };
        this.demoLastDirection = 'horizontal';
      } else {
        this.lastTailCoord = { row: startRow, col: startCol + L - 1 };
        this.lastDirection = 'horizontal';
      }
    } else {
      // 後續詞彙：與上一詞尾字交錯咬合 (樞紐 Pivot)
      const prevTail = isDemo ? this.demoLastTailCoord : this.lastTailCoord;
      const lastDir = isDemo ? this.demoLastDirection : this.lastDirection;
      const prevKey = `${prevTail.row},${prevTail.col}`;
      let isHomoPivot = false;
      let prevChar = "";

      // 標記咬合樞紐字 (判斷是否為同音不同字)
      if (boardMap.has(prevKey)) {
        const prevData = boardMap.get(prevKey);
        prevChar = prevData.char;
        if (prevChar && prevChar !== chars[0]) {
          isHomoPivot = true;
          prevData.isHomo = true;
          prevData.prevChar = prevChar;
          prevData.prevWord = prevData.word || "";
          prevData.char = chars[0];
          prevData.nextChar = chars[0];
          const matchResult = checkPhoneticMatch(prevChar, chars[0], true, false, prevData.word, word);
          if (matchResult && matchResult.matchingZhuyin) {
            prevData.matchingZhuyin = matchResult.matchingZhuyin;
          }
          prevData.word = word;
        }
        prevData.isPivot = true;
      }

      // 決定新詞走向：與上一詞正交垂直 (Horizontal <-> Vertical)
      const newDir = (lastDir === 'horizontal') ? 'vertical' : 'horizontal';

      if (newDir === 'vertical') {
        // 縱向往下自然推進 (無拘束延伸，避免折返碰撞)
        placedCoords.push({ row: prevTail.row, col: prevTail.col, char: chars[0], isPivot: true, isHomo: isHomoPivot, prevChar: prevChar, speaker: speakerType });
        for (let i = 1; i < L; i++) {
          const r = prevTail.row + i;
          const c = prevTail.col;
          const ch = chars[i];
          const zh = getCharZhuyin(ch);
          boardMap.set(`${r},${c}`, { char: ch, speaker: speakerType, zhuyin: zh, isPivot: false, word: word });
          placedCoords.push({ row: r, col: c, char: ch, isPivot: false, speaker: speakerType });
        }
        if (isDemo) {
          this.demoLastTailCoord = { row: prevTail.row + L - 1, col: prevTail.col };
          this.demoLastDirection = 'vertical';
        } else {
          this.lastTailCoord = { row: prevTail.row + L - 1, col: prevTail.col };
          this.lastDirection = 'vertical';
        }
      } else {
        // 橫向往右自然推進 (隨畫布自適應向右延伸)
        placedCoords.push({ row: prevTail.row, col: prevTail.col, char: chars[0], isPivot: true, isHomo: isHomoPivot, prevChar: prevChar, speaker: speakerType });
        for (let i = 1; i < L; i++) {
          const r = prevTail.row;
          const c = prevTail.col + i;
          const ch = chars[i];
          const zh = getCharZhuyin(ch);
          boardMap.set(`${r},${c}`, { char: ch, speaker: speakerType, zhuyin: zh, isPivot: false, word: word });
          placedCoords.push({ row: r, col: c, char: ch, isPivot: false, speaker: speakerType });
        }
        if (isDemo) {
          this.demoLastTailCoord = { row: prevTail.row, col: prevTail.col + L - 1 };
          this.demoLastDirection = 'horizontal';
        } else {
          this.lastTailCoord = { row: prevTail.row, col: prevTail.col + L - 1 };
          this.lastDirection = 'horizontal';
        }
      }
    }

    // 計算當前棋盤邊界並調整畫布尺寸 (留出寬裕呼吸邊界)
    for (const p of placedCoords) {
      if (isDemo) {
        if (p.row < this.demoMinRow) this.demoMinRow = p.row;
        if (p.row > this.demoMaxRow) this.demoMaxRow = p.row;
        if (p.col < this.demoMinCol) this.demoMinCol = p.col;
        if (p.col > this.demoMaxCol) this.demoMaxCol = p.col;
      } else {
        if (p.row < this.minRow) this.minRow = p.row;
        if (p.row > this.maxRow) this.maxRow = p.row;
        if (p.col < this.minCol) this.minCol = p.col;
        if (p.col > this.maxCol) this.maxCol = p.col;
      }
    }

    const curMaxCol = isDemo ? this.demoMaxCol : this.maxCol;
    const curMaxRow = isDemo ? this.demoMaxRow : this.maxRow;
    const gridW = Math.max(1200, (curMaxCol + 16) * 44);
    const gridH = Math.max(800, (curMaxRow + 16) * 44);
    grid.style.width = `${gridW}px`;
    grid.style.height = `${gridH}px`;

    // 渲染或更新 DOM 格子
    placedCoords.forEach(p => {
      const cellId = `${cellPrefix}${p.row}-${p.col}`;
      let cell = document.getElementById(cellId);
      const zh = getCharZhuyin(p.char);

      if (!cell) {
        cell = document.createElement("div");
        cell.id = cellId;
        cell.className = `board-cell ${speakerType} ${p.isPivot ? "cross-pivot" : ""}`;
        cell.style.left = `${p.col * 44}px`;
        cell.style.top = `${p.row * 44}px`;
        cell.innerHTML = `
          <span class="cell-char">${p.char}</span>
          <span class="cell-ruby">${zh}</span>
        `;
        grid.appendChild(cell);
      }

      // 樞紐字更新樣式：區分「同字直咬」與「同音不同字 (支援 A/B/C 三種風格)」
      if (p.isPivot) {
        if (p.isHomo && p.prevChar && p.prevChar !== p.char) {
          this.renderHomoCell(cell, p);
        } else {
          cell.classList.add("cross-pivot");
        }
      }
    });

    // 清理殘留舊氣泡 (對弈對白已全面精簡整合至中下方心戰氣泡，棋盤保持 100% 乾淨無遮擋)
    const oldBubbles = Array.from(grid.querySelectorAll(".board-bubble"));
    oldBubbles.forEach(b => {
      if (b && b.parentNode) b.parentNode.removeChild(b);
    });

    // 平滑滾動視窗聚焦於最新落子字陣處 (預留 100px 舒適呼吸空間，徹底避免貼邊或切字)
    const viewport = document.getElementById(viewportId);
    if (viewport) {
      let minX = Math.min(...placedCoords.map(p => p.col * 44));
      let maxX = Math.max(...placedCoords.map(p => (p.col + 1) * 44));
      let minY = Math.min(...placedCoords.map(p => p.row * 44));
      let maxY = Math.max(...placedCoords.map(p => (p.row + 1) * 44));

      // 預留 100px 呼吸邊距
      const PADDING = 100;
      const roiMinX = Math.max(0, minX - PADDING);
      const roiMaxX = maxX + PADDING;
      const roiMinY = Math.max(0, minY - PADDING);
      const roiMaxY = maxY + PADDING;

      // 計算目標置中滾動位置 (延遲 40ms 等待 DOM 排版與彈性盒尺寸穩定，確保精準平滑居中)
      setTimeout(() => {
        const currentScale = viewport._zoomScale || 1.0;
        let targetScrollLeft, targetScrollTop;

        if (isInitial) {
          // 起始立題時：題目字格與提示氣泡直接精準對齊畫布左上角 (保留 16px 舒適呼吸空間，完美適應手機直式螢幕)
          targetScrollLeft = Math.max(0, (minX * currentScale) - 16);
          targetScrollTop = Math.max(0, (minY * currentScale) - 16);
        } else {
          // 後續輪次：維持置中聚焦視野
          const centerX = ((roiMinX + roiMaxX) / 2) * currentScale;
          const centerY = ((roiMinY + roiMaxY) / 2) * currentScale;
          targetScrollLeft = Math.max(0, centerX - (viewport.clientWidth / 2));
          targetScrollTop = Math.max(0, centerY - (viewport.clientHeight / 2));
        }

        viewport.scrollTo({
          left: targetScrollLeft,
          top: targetScrollTop,
          behavior: "smooth"
        });
      }, 40);
    }
  }

  // ==========================================
  // 7.0 視窗即攝影鏡頭：字陣畫布按住攀移與光學變焦 (Camera Pan & Zoom Engine)
  // ==========================================
  setupViewportPan(viewport) {
    if (!viewport || viewport._panInitialized) return;
    viewport._panInitialized = true;
    viewport._zoomScale = 1.0;

    let isDown = false;
    let startX = 0;
    let startY = 0;
    let scrollLeft = 0;
    let scrollTop = 0;

    // 滑鼠按下 (Mousedown: 支援左鍵與中鍵攀移)
    viewport.addEventListener("mousedown", (e) => {
      if (e.button !== 0 && e.button !== 1) return;
      isDown = true;
      viewport.classList.add("is-panning");
      startX = e.pageX;
      startY = e.pageY;
      scrollLeft = viewport.scrollLeft;
      scrollTop = viewport.scrollTop;
      e.preventDefault();
    });

    // 滑鼠放開或離開視窗 (Mouseup / Window Blur)
    window.addEventListener("mouseup", () => {
      if (isDown) {
        isDown = false;
        viewport.classList.remove("is-panning");
      }
    });

    // 滑鼠拖曳攀移 (Mousemove: 1:1 實體跟手感)
    window.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      e.preventDefault();
      const dx = e.pageX - startX;
      const dy = e.pageY - startY;
      viewport.scrollLeft = scrollLeft - dx;
      viewport.scrollTop = scrollTop - dy;
    });

    // Google Maps 風格：滑鼠滾輪向游標焦點平滑光學縮放 (Wheel Zoom to Cursor)
    viewport.addEventListener("wheel", (e) => {
      e.preventDefault();
      const oldScale = viewport._zoomScale || 1.0;
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      const newScale = Math.min(2.2, Math.max(0.35, parseFloat((oldScale * factor).toFixed(2))));
      if (newScale === oldScale) return;

      const grid = viewport.querySelector(".cross-board-grid");
      if (!grid) return;

      const rect = viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const contentX = (viewport.scrollLeft + mouseX) / oldScale;
      const contentY = (viewport.scrollTop + mouseY) / oldScale;

      viewport._zoomScale = newScale;
      grid.style.transform = `scale(${newScale})`;
      grid.style.transformOrigin = "0 0";

      viewport.scrollLeft = contentX * newScale - mouseX;
      viewport.scrollTop = contentY * newScale - mouseY;

      this.updateZoomHUD(viewport);

      // 滾輪縮放時切換放大鏡游標回饋
      viewport.classList.remove("is-zooming-in", "is-zooming-out");
      viewport.classList.add(e.deltaY < 0 ? "is-zooming-in" : "is-zooming-out");
      clearTimeout(viewport._zoomTimer);
      viewport._zoomTimer = setTimeout(() => {
        viewport.classList.remove("is-zooming-in", "is-zooming-out");
      }, 450);
    }, { passive: false });

    // Ctrl 鍵按住時提示放大鏡游標 (Ctrl Key Zoom Hint)
    window.addEventListener("keydown", (e) => {
      if (e.key === "Control") viewport.classList.add("ctrl-zoom");
    });
    window.addEventListener("keyup", (e) => {
      if (e.key === "Control") viewport.classList.remove("ctrl-zoom");
    });

    // 雙擊畫布重設縮放或置中居中 (Double-click Reset)
    viewport.addEventListener("dblclick", (e) => {
      if (e.target === viewport || e.target.classList.contains("cross-board-grid")) {
        this.recenterViewport(viewport, viewport.id.includes("demo"), true);
      }
    });

    // 觸控螢幕攀移支援 (Touchstart / Touchmove for Mobile & Tablet)
    let touchStartX = 0;
    let touchStartY = 0;
    let touchScrollLeft = 0;
    let touchScrollTop = 0;

    viewport.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].pageX;
        touchStartY = e.touches[0].pageY;
        touchScrollLeft = viewport.scrollLeft;
        touchScrollTop = viewport.scrollTop;
      }
    }, { passive: true });

    viewport.addEventListener("touchmove", (e) => {
      if (e.touches.length === 1) {
        const dx = e.touches[0].pageX - touchStartX;
        const dy = e.touches[0].pageY - touchStartY;
        viewport.scrollLeft = touchScrollLeft - dx;
        viewport.scrollTop = touchScrollTop - dy;
      }
    }, { passive: true });
  }

  updateZoomHUD(viewport) {
    if (!viewport) return;
    const isDemo = viewport.id.includes("demo");
    const valEl = document.getElementById(isDemo ? "zoom-val-demo" : "zoom-val-battle");
    if (valEl) {
      const scale = viewport._zoomScale || 1.0;
      valEl.innerText = `${Math.round(scale * 100)}%`;
    }
  }

  zoomViewport(viewport, delta) {
    if (!viewport) return;
    const grid = viewport.querySelector(".cross-board-grid");
    if (!grid) return;
    const oldScale = viewport._zoomScale || 1.0;
    const newScale = Math.min(2.2, Math.max(0.35, parseFloat((oldScale + delta).toFixed(2))));
    if (newScale === oldScale) return;

    const centerX = viewport.scrollLeft + viewport.clientWidth / 2;
    const centerY = viewport.scrollTop + viewport.clientHeight / 2;
    const contentX = centerX / oldScale;
    const contentY = centerY / oldScale;

    viewport._zoomScale = newScale;
    grid.style.transform = `scale(${newScale})`;
    grid.style.transformOrigin = "0 0";

    viewport.scrollLeft = contentX * newScale - viewport.clientWidth / 2;
    viewport.scrollTop = contentY * newScale - viewport.clientHeight / 2;
    this.updateZoomHUD(viewport);
  }

  recenterViewport(viewport, isDemo = false, resetScale = true) {
    if (!viewport) return;
    const grid = viewport.querySelector(".cross-board-grid");
    if (resetScale && grid) {
      viewport._zoomScale = 1.0;
      grid.style.transform = "scale(1)";
      grid.style.transformOrigin = "0 0";
      this.updateZoomHUD(viewport);
    }
    const lastCoord = isDemo ? this.demoLastTailCoord : this.lastTailCoord;
    const rounds = isDemo ? this.demoRound : this.roundCount;
    if (lastCoord) {
      const scale = viewport._zoomScale || 1.0;
      if (rounds <= 1) {
        const targetX = (lastCoord.col * 44 + 22) * scale;
        const targetY = (lastCoord.row * 44 + 22) * scale;
        viewport.scrollTo({
          left: Math.max(0, targetX - viewport.clientWidth / 2),
          top: Math.max(0, targetY - viewport.clientHeight / 3),
          behavior: "smooth"
        });
      } else {
        const targetX = (lastCoord.col * 44 + 22) * scale;
        const targetY = (lastCoord.row * 44 + 22) * scale;
        viewport.scrollTo({
          left: Math.max(0, targetX - viewport.clientWidth / 2),
          top: Math.max(0, targetY - viewport.clientHeight / 2),
          behavior: "smooth"
        });
      }
    }
  }

  // ==========================================
  // 6.8 自由拖曳縮放控制器 (Draggable Zoom HUD)
  // ==========================================
  makeDraggable(el, storageKey, handleSelector = null) {
    if (!el || el._dragInitialized) return;
    el._dragInitialized = true;

    // 載入玩家先前自訂的位置
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const { left, top } = JSON.parse(saved);
        if (typeof left === "number" && typeof top === "number") {
          const maxLeft = Math.max(10, window.innerWidth - (el.offsetWidth || 120));
          const maxTop = Math.max(10, window.innerHeight - (el.offsetHeight || 120));
          el.style.left = `${Math.min(maxLeft, Math.max(10, left))}px`;
          el.style.top = `${Math.min(maxTop, Math.max(10, top))}px`;
          el.style.right = "auto";
          el.style.bottom = "auto";
        }
      }
    } catch {}

    let isDown = false;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    const onPointerDown = (e) => {
      // 若指定了 handleSelector，且點擊目標不在 handle 內，則不啟動拖曳 (避免阻礙內部文字選取與滾動)
      if (handleSelector && !e.target.closest(handleSelector)) return;
      if (e.target.tagName === "BUTTON" || e.target.closest("button")) return;

      isDown = true;
      isDragging = false;
      startX = e.clientX;
      startY = e.clientY;
      const rect = el.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      if (el.setPointerCapture) el.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e) => {
      if (!isDown) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!isDragging && Math.hypot(dx, dy) > 4) {
        isDragging = true;
        el.classList.add("is-dragging");
      }
      if (isDragging) {
        e.preventDefault();
        const maxL = Math.max(10, window.innerWidth - (el.offsetWidth || 80) - 10);
        const maxT = Math.max(10, window.innerHeight - (el.offsetHeight || 60) - 10);
        const curLeft = Math.min(maxL, Math.max(8, initialLeft + dx));
        const curTop = Math.min(maxT, Math.max(8, initialTop + dy));
        el.style.left = `${curLeft}px`;
        el.style.top = `${curTop}px`;
        el.style.right = "auto";
        el.style.bottom = "auto";
      }
    };

    const onPointerUp = (e) => {
      if (!isDown) return;
      isDown = false;
      if (isDragging) {
        el.classList.remove("is-dragging");
        try {
          const rect = el.getBoundingClientRect();
          localStorage.setItem(storageKey, JSON.stringify({ left: rect.left, top: rect.top }));
        } catch {}
      }
      if (el.releasePointerCapture) {
        try { el.releasePointerCapture(e.pointerId); } catch {}
      }
    };

    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }

  // ==========================================
  // 6.8 瀏覽器位置探知（科學園區精準推測：竹科、內科、汐科、南科、中科）
  // ==========================================
  detectUserTechPark() {
    try {
      const savedPark = localStorage.getItem("wordchain_user_tech_park");
      if (savedPark) {
        this.userTechPark = savedPark;
      }
    } catch {}

    if (!navigator || !navigator.geolocation) return;

    // 非同步靜默偵測，獲取玩家大致經緯度並映射至各大科學園區
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        // 定義各大主要科學園區概略中心經緯度
        // 竹科 (Hsinchu): 24.77, 121.01
        // 內科 (Neihu, Taipei): 25.08, 121.57
        // 汐科 (Xizhi, New Taipei): 25.06, 121.65
        // 中科 (Taichung): 24.21, 120.61
        // 南科 (Tainan): 23.11, 120.28
        const PARKS = [
          { name: "竹科", lat: 24.77, lng: 121.01, descSuffix: "新竹科學園區頂尖工程師" },
          { name: "內科", lat: 25.08, lng: 121.57, descSuffix: "內湖科學園區（內科）演算法高手" },
          { name: "汐科", lat: 25.06, lng: 121.65, descSuffix: "汐止科學園區（汐科）資深硬核架構師" },
          { name: "中科", lat: 24.21, lng: 120.61, descSuffix: "中部科學園區（中科）精密製程大師" },
          { name: "南科", lat: 23.11, lng: 120.28, descSuffix: "南部科學園區（南科）先進半導體巨擘" },
        ];

        let minDis = 999999;
        let nearestPark = "竹科";
        PARKS.forEach(p => {
          const d = Math.hypot(lat - p.lat, lng - p.lng);
          if (d < minDis) {
            minDis = d;
            nearestPark = p.name;
          }
        });

        // 若距離小於 0.65 度（約 70 公里內）則命中該園區，否則預設竹科
        if (minDis <= 0.65) {
          this.userTechPark = nearestPark;
          try { localStorage.setItem("wordchain_user_tech_park", nearestPark); } catch {}
        }
      },
      (err) => {
        // 使用者未授權或超時，保持竹科/內科等合理預設
      },
      { timeout: 8000, maximumAge: 3600000 }
    );
  }

  // ==========================================
  // 6.9 詞海星盤 · 行業從業人員 · 職業神算分析器 (Career Divination)
  // ==========================================
  divineCareer(words = []) {
    if (!words || words.length === 0) {
      return {
        tag: "文壇初試 · 璞玉渾金",
        title: "深不可測的初入江湖隱士！",
        desc: "落子雖簡，字骨清奇；尚未完全展露真實行業神通，下一局且看閣下大顯身手！"
      };
    }

    const allText = words.join(" ");

    let techScore = 0;
    let telecomScore = 0;
    let icuScore = 0;
    let medScore = 0;
    let driverScore = 0;
    let legalScore = 0;
    let finScore = 0;
    let civilScore = 0;
    let mktScore = 0;
    let chefScore = 0;
    let designScore = 0;
    let eduScore = 0;
    let litScore = 0;

    const TECH_KWS = ["晶片", "半導體", "電路", "積體", "演算法", "計算機", "伺服器", "記憶體", "資料庫", "程式", "軟體", "硬體", "微處理", "代碼", "機器學習", "人工智慧", "數據", "數位", "編碼", "邏輯", "架構", "除錯", "變數", "函式", "系統", "工程師", "電子", "資訊", "雲端", "運算", "終端"];
    const TELECOM_KWS = ["光纖", "訊號", "頻寬", "介面", "傳輸", "電信", "基站", "天線", "通訊", "基地台", "光纜", "電纜", "路由", "光電", "波長", "信道", "寬頻", "通訊協定", "微波", "射頻", "局端"];
    const ICU_KWS = ["加護", "急救", "插管", "心肺", "葉克膜", "敗血", "休克", "甦醒", "重症", "加護病房", "點滴", "心律", "監護", "生命徵象", "抗體", "引流", "氣切", "導管", "呼吸器", "護理", "護理師"];
    const MED_KWS = ["心肌", "免疫", "神經", "血小板", "動脈", "靜脈", "抗生素", "病理", "臨床", "診斷", "處方", "染色體", "內分泌", "外科", "內科", "阿斯匹靈", "病毒", "細胞", "基因", "酵素", "腫瘤", "血壓", "血糖", "疫苗", "膠囊", "藥劑", "生理", "解剖", "組織", "器官", "血液", "細菌", "感染", "代謝", "醫生", "醫師", "藥師"];
    const DRIVER_KWS = ["運將", "計程車", "導航", "超車", "快車道", "慢車道", "迴轉", "收費站", "交流道", "國道", "省道", "平交道", "煞車", "油門", "里程", "轉運", "紅綠燈", "斑馬線", "乘客", "車牌", "司機", "老司機", "公車", "捷運", "高鐵", "班車", "客運", "交通", "載客", "排班"];
    const LEGAL_KWS = ["訴訟", "刑事", "民事", "賠償", "處分", "合約", "契約", "原告", "被告", "法官", "律師", "違憲", "違法", "法人", "誠信", "不可抗力", "答辯", "起訴", "上訴", "條例", "憲法", "法規", "裁判", "判決", "損害", "公證", "代理", "罪刑", "審判", "仲裁", "管轄", "抗辯", "證據", "認證"];
    const FIN_KWS = ["通膨", "膨脹", "投資", "報酬", "流動性", "資產", "負債", "避險", "貨幣", "資本", "殖利率", "外匯", "股市", "融資", "融券", "債券", "基金", "利息", "利率", "證券", "期貨", "營收", "獲利", "股權", "估值", "槓桿", "套利", "籌碼", "大盤", "指數", "匯率", "金融", "信貸", "財經"];
    const CIVIL_KWS = ["混凝土", "鋼筋", "力學", "結構", "地基", "透視", "承重", "營造", "樑柱", "灌漿", "鷹架", "都市", "建築", "砌磚", "工法", "基樁", "耐震", "工程", "土木", "測量", "鋼骨"];
    const MKT_KWS = ["流量", "行銷", "品牌", "社群", "推廣", "爆款", "文案", "轉換", "點閱", "觸及", "粉專", "宣傳", "受眾", "公關", "話題", "曝光", "網紅"];
    const CHEF_KWS = ["火候", "調味", "燉煮", "烘焙", "香料", "食材", "料理", "煨", "爆炒", "慢火", "煨湯", "高湯", "醬汁", "主廚", "廚藝", "佳餚", "饕客", "烹飪", "酸甜", "香氣", "擺盤"];
    const DESIGN_KWS = ["排版", "字型", "對齊", "配色", "對比", "向量", "像素", "色票", "美感", "留白", "比例", "構圖", "透視", "層次", "筆畫", "視覺", "修圖", "質感", "手繪", "設計師"];
    const EDU_KWS = ["作育", "英才", "教案", "考卷", "備課", "訓導", "啟發", "板書", "講義", "作業", "學分", "答辯", "作答", "批改", "導師", "教授", "諄諄教誨", "循循善誘", "教學", "課堂"];

    TECH_KWS.forEach(k => { if (allText.includes(k)) techScore += 2; });
    TELECOM_KWS.forEach(k => { if (allText.includes(k)) telecomScore += 2.5; });
    ICU_KWS.forEach(k => { if (allText.includes(k)) icuScore += 2.5; });
    MED_KWS.forEach(k => { if (allText.includes(k)) medScore += 2; });
    DRIVER_KWS.forEach(k => { if (allText.includes(k)) driverScore += 2.5; });
    LEGAL_KWS.forEach(k => { if (allText.includes(k)) legalScore += 2; });
    FIN_KWS.forEach(k => { if (allText.includes(k)) finScore += 2; });
    CIVIL_KWS.forEach(k => { if (allText.includes(k)) civilScore += 2; });
    MKT_KWS.forEach(k => { if (allText.includes(k)) mktScore += 2; });
    CHEF_KWS.forEach(k => { if (allText.includes(k)) chefScore += 2.5; });
    DESIGN_KWS.forEach(k => { if (allText.includes(k)) designScore += 2.5; });
    EDU_KWS.forEach(k => { if (allText.includes(k)) eduScore += 2.5; });

    words.forEach(w => {
      if (window.STORY_CACHE && window.STORY_CACHE[w]) litScore += 2;
      if (w.length >= 5) litScore += 3;
    });

    // 優先比對百工百業擴充星盤庫 (window.CAREER_DATABASE，含軍人、老饕、機師、消防、青農、電競、刑警、音樂等)
    if (window.CAREER_DATABASE && Array.isArray(window.CAREER_DATABASE)) {
      let bestCareerMatch = null;
      let maxMatchScore = 0;

      window.CAREER_DATABASE.forEach(item => {
        let matchCount = 0;
        if (item.keywords && Array.isArray(item.keywords)) {
          item.keywords.forEach(k => {
            if (allText.includes(k)) matchCount += 2.5;
          });
        }
        if (matchCount > maxMatchScore) {
          maxMatchScore = matchCount;
          bestCareerMatch = item;
        }
      });

      if (bestCareerMatch && maxMatchScore >= 2.5) {
        return {
          tag: bestCareerMatch.tag,
          title: bestCareerMatch.title,
          desc: bestCareerMatch.desc
        };
      }
    }

    const scores = [
      { domain: "telecom", score: telecomScore },
      { domain: "icu", score: icuScore },
      { domain: "driver", score: driverScore },
      { domain: "chef", score: chefScore },
      { domain: "design", score: designScore },
      { domain: "edu", score: eduScore },
      { domain: "tech", score: techScore },
      { domain: "med", score: medScore },
      { domain: "legal", score: legalScore },
      { domain: "fin", score: finScore },
      { domain: "civil", score: civilScore },
      { domain: "mkt", score: mktScore }
    ];
    scores.sort((a, b) => b.score - a.score);

    const topDomain = scores[0];

    if (topDomain.score >= 2) {
      if (topDomain.domain === "telecom") {
        return {
          tag: "📡 烽火星盤 · 詩書若纜",
          title: "詩書若纜——閣下該不是飛天遁地的資深電信工程師吧？",
          desc: "光纖為脈、訊號連天，出招佈線如百萬兆寬頻般高速穿透，任何字陣網絡障礙瞬間打通！"
        };
      } else if (topDomain.domain === "icu") {
        return {
          tag: "❤️ 仁心星盤 · 熱血守護",
          title: "滿腔熱血——閣下莫非是日夜守護生命線的 ICU 護理師？",
          desc: "反應極速、臨危不亂，任憑局面多麼凶險，總能一招插管給氧、起死回生絕地大逆轉！"
        };
      } else if (topDomain.domain === "driver") {
        return {
          tag: "🚕 馳騁星盤 · 運將豪傑",
          title: "滿腹經綸運匠大哥大——穿梭千街萬巷的文壇老司機！",
          desc: "四通八達、路況如指掌，超車變道瀟灑自如，帶領對手在詞海大街小巷兜風直接抵達終點！"
        };
      } else if (topDomain.domain === "chef") {
        return {
          tag: "🍳 珍饈星盤 · 國宴大廚",
          title: "文思入味、火候精準——閣下該不會是摘星無數的頂級料理長吧？",
          desc: "咬字有味、調和五音，落子猶如大火爆炒與文火慢燉相得益彰，端出一盤盤色香味俱全的字陣盛宴！"
        };
      } else if (topDomain.domain === "design") {
        return {
          tag: "🎨 丹青星盤 · 視覺巨匠",
          title: "點線面皆成章——閣下定是美感超群的資深字體或視覺設計師！",
          desc: "棋盤縱橫兼顧黃金比例與留白韻律，出招字形優雅端莊，連錯位銜接都充滿強烈視覺張力！"
        };
      } else if (topDomain.domain === "edu") {
        return {
          tag: "🍎 鐸聲星盤 · 杏壇名師",
          title: "諄諄善誘、作育英才——閣下莫非是文壇名校的王牌名師？",
          desc: "出招條理分明如教科書示範，信手拈來皆是標準教案，對弈之間早已將對手循循善誘引入深奧學海！"
        };
      } else if (topDomain.domain === "tech") {
        const parkName = this.userTechPark || "竹科";
        let parkDesc = "字裡行間半導體、晶片與演算法之氣場濃烈，若非科學園區科技大老，定是隱世全棧架構師！";
        if (parkName === "內科") {
          parkDesc = "字裡行間滿溢網路雲端與軟體架構之氣場，兼具內科（內湖科學園區）頂尖軟體大師風範！";
        } else if (parkName === "汐科") {
          parkDesc = "出招嚴謹如資通訊與硬體資安協定，渾身散發汐科（汐止科學園區）硬核高手氣場！";
        } else if (parkName === "南科") {
          parkDesc = "落子精度宛如 2nm 先進製程，深藏南部科學園區（南科）晶圓級強悍實力！";
        } else if (parkName === "中科") {
          parkDesc = "招招緊湊精準如高階精密光電，具備中部科學園區（中科）大匠之風！";
        }

        return {
          tag: `💻 ${parkName}星盤 · 科技極客`,
          title: `您該不是被詩詞耽誤的${parkName}工程師吧？XD`,
          desc: parkDesc
        };
      } else if (topDomain.domain === "med") {
        return {
          tag: "🩺 杏林星盤 · 名醫聖手",
          title: "落子如切脈施針——閣下莫非是醫學中心的隱世神醫？",
          desc: "診斷精確、出手如手術刀般游刃有餘，文壇對弈竟透著頂尖名醫之沉著氣度！"
        };
      } else if (topDomain.domain === "legal") {
        return {
          tag: "⚖️ 法政星盤 · 王牌大狀",
          title: "字字千鈞、滴水不漏——閣下該不是剛打贏勝訴官司的王牌大律師吧？",
          desc: "法理分明、條例嚴謹、邏輯如銅牆鐵壁，對手稍有漏洞即被當庭依法絕殺！"
        };
      } else if (topDomain.domain === "fin") {
        return {
          tag: "📈 財經星盤 · 華爾街之狼",
          title: "盤面槓桿算盡——閣下莫非是縱橫外資圈的操盤高手？",
          desc: "出招皆在精準調度流動性與避險籌碼，每一步接龍都在計算最高的投資報酬率！"
        };
      } else if (topDomain.domain === "civil") {
        return {
          tag: "🏛️ 營造星盤 · 結構大師",
          title: "字陣縱橫穩如泰山——閣下該不會是國家級建築大師或結構技師吧？",
          desc: "二維字陣交錯咬合、力學結構滴水不漏，連紀曉嵐都讚嘆此乃神級營造工法！"
        };
      } else if (topDomain.domain === "mkt") {
        return {
          tag: "📢 傳播星盤 · 社群鬼才",
          title: "字字直擊痛點——閣下定是操盤千萬爆款的社群行銷操盤手！",
          desc: "出招自帶百萬流量密碼與轉發衝動，連出成語都在做文案 A/B Testing！"
        };
      }
    }

    if (litScore >= 5 || (litScore / (words.length * 2 || 1)) >= 0.5) {
      return {
        tag: "🎓 翰林星盤 · 當代詞宗",
        title: "滿腹經綸、氣吞山河——閣下莫非是文學院客座教授或文曲星轉世？",
        desc: "經史子集、唐詩宋詞信手拈來，四庫全書信手翻閱，風雅絕代，名士太白亦甘拜下風！"
      };
    }

    return {
      tag: "🌈 無雙星盤 · 跨界博學",
      title: "博古通今、跨界無雙——閣下定是無所不知的跨領域大斜槓奇才！",
      desc: "上通科技天文、下達律法經世，兼修文史藝術，出招路數神鬼莫測，堪稱文壇全能通才！"
    };
  }

  // ==========================================
  // 7.1 同音不同字呈現系統 (A: 合璧磚 / B: 音律橋 / C: 翻轉與滑動牌)
  // ==========================================
  renderHomoCell(cell, cellData) {
    const prevC = cellData.prevChar;
    const nextC = cellData.char;
    const matchCheck = (prevC && nextC) ? checkPhoneticMatch(prevC, nextC, true, false, cellData.prevWord, cellData.word) : null;
    const sharedZh = cellData.matchingZhuyin || (matchCheck && matchCheck.matchingZhuyin) || getCharZhuyin(nextC) || getCharZhuyin(prevC) || "—";
    const speaker = cellData.speaker || "player";

    if (this.homoStyle === "bridge") {
      // 方案 B：雙星音律橋
      cell.className = `board-cell ${speaker} cross-pivot cross-pivot-homo style-bridge`;
      cell.innerHTML = `
        <div class="homo-bridge-box" title="上一詞尾字「${prevC}」➔ 接招首字「${nextC}」(同音：${sharedZh})">
          <div class="bead bead-prev">${prevC}</div>
          <div class="bridge-link"></div>
          <div class="bead bead-next">${nextC}</div>
        </div>
        <span class="cell-ruby" style="color:#2ed573; font-weight:bold; font-size:0.5rem; margin-top:2px;">${sharedZh}</span>
      `;
    } else if (this.homoStyle === "flip") {
      // 方案 C：太極翻轉與滑動牌 (多維方向：左右翻轉 / 上下翻轉 / 縱向滑動 / 橫向滑動)
      const variants = ["anim-flip-y", "anim-flip-x", "anim-slide-y", "anim-slide-x"];
      const vIndex = Math.abs((cellData.row * 3 + cellData.col * 7)) % variants.length;
      const variantClass = variants[vIndex];
      const variantTitles = {
        "anim-flip-y": "左右太極翻轉",
        "anim-flip-x": "上下乾坤翻轉",
        "anim-slide-y": "縱向行雲滑動",
        "anim-slide-x": "橫向流光滑動"
      };
      const motionDesc = variantTitles[variantClass] || "太極翻轉牌";

      cell.className = `board-cell ${speaker} cross-pivot cross-pivot-homo style-flip`;
      cell.innerHTML = `
        <div class="flip-card-inner ${variantClass}" title="太極翻轉牌【${motionDesc}】：自動慢速流轉（懸停或點擊定格）：上一詞尾字「${prevC}」➔ 接招首字「${nextC}」(同音：${sharedZh})">
          <div class="flip-card-front">
            <span class="flip-badge">首</span>
            <span style="font-size:1.15rem; font-weight:900;">${nextC}</span>
            <span class="cell-ruby" style="color:var(--accent-gold);">${sharedZh}</span>
          </div>
          <div class="flip-card-back">
            <span class="flip-badge">尾</span>
            <span style="font-size:1.15rem; font-weight:900;">${prevC}</span>
            <span class="cell-ruby" style="color:var(--player-pink);">${sharedZh}</span>
          </div>
        </div>
      `;
      cell.onclick = () => {
        cell.classList.toggle("paused");
        if (cell.classList.contains("paused")) {
          showToast(`⏸️ 【${motionDesc}】已定格，再次點擊恢復流轉`, "info", 1500);
        } else {
          showToast(`▶️ 【${motionDesc}】已恢復流轉`, "info", 1500);
        }
      };
    } else {
      // 方案 A：合璧雙字磚 (預設)
      cell.className = `board-cell ${speaker} cross-pivot cross-pivot-homo style-tile`;
      cell.innerHTML = `
        <div class="homo-tile-box" title="上一詞尾字「${prevC}」➔ 接招首字「${nextC}」(同音：${sharedZh})">
          <span class="prev-char">${prevC}</span>
          <span class="homo-slash">/</span>
          <span class="next-char">${nextC}</span>
        </div>
        <span class="cell-ruby" style="color:var(--accent-gold); font-weight:bold;">${sharedZh}</span>
      `;
    }
  }

  refreshHomoCells() {
    for (const [key, data] of this.boardMap.entries()) {
      if (data.isPivot && data.isHomo && data.prevChar && data.prevChar !== data.char) {
        const [r, c] = key.split(",");
        const cell = document.getElementById(`cell-${r}-${c}`);
        if (cell) {
          this.renderHomoCell(cell, data);
        }
      }
    }
    for (const [key, data] of this.demoBoardMap.entries()) {
      if (data.isPivot && data.isHomo && data.prevChar && data.prevChar !== data.char) {
        const [r, c] = key.split(",");
        const cell = document.getElementById(`demo-cell-${r}-${c}`);
        if (cell) {
          this.renderHomoCell(cell, data);
        }
      }
    }
  }

  // ==========================================
  // 8. 結構化對弈流轉表 (Flow Table & Replay)
  // ==========================================
  appendFlowTableRow(round, speaker, word, modeTag, elapsed, points) {
    const tbody = document.getElementById("flow-table-body");
    if (!tbody) return;

    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";

    const headC = getHeadChar(word);
    const tailC = getTailChar(word);
    const headZh = getWordHeadZhuyin(word) || "—";
    const tailZh = getWordTailZhuyin(word) || "—";

    const isP = speaker.includes("閣下") || speaker.includes("軍師");
    const speakerColor = isP ? "var(--player-pink)" : "var(--ai-blue)";

    let badgeClass = "badge-exact";
    if (modeTag.includes("諧音")) badgeClass = "badge-homo-soul";
    else if (modeTag.includes("同音") || modeTag.includes("借音")) badgeClass = "badge-homo";
    else if (modeTag.includes("超時") || modeTag.includes("急救")) badgeClass = "badge-danger";

    tr.innerHTML = `
      <td style="text-align:center; font-size:0.85rem;">${round}</td>
      <td style="text-align:center; font-weight:bold; color:${speakerColor};">${speaker}</td>
      <td style="font-weight:bold; font-size:1rem; color:var(--text-bright);">${word}</td>
      <td style="font-size:0.75rem; color:var(--text-muted);">${headZh} ➔ ${tailZh}</td>
      <td style="text-align:center;"><span class="badge ${badgeClass}" style="font-size:0.75rem;">${modeTag}</span></td>
      <td style="text-align:center; font-size:0.8rem; color:var(--text-muted);">${elapsed.toFixed(1)}s</td>
      <td style="text-align:center; font-weight:bold; color:${points > 0 ? '#00e676' : 'var(--text-muted)'};">+${points}</td>
    `;

    // 點擊任意輪次即時覆盤回放
    tr.onclick = () => {
      this.updateStoryCard(word);
      const persona = PERSONAS[this.currentPersona];
      this.updateScorerCard(round, speaker, word, modeTag, `${elapsed.toFixed(1)}s`, `${word.length}字`, "流轉覆盤", "歷史點評重溫", points, 0);
      showToast(`已載入第 ${round} 輪【${word}】典故與裁判戰報！`, "info", 2000);
    };

    tbody.appendChild(tr);

    const tableContainer = document.getElementById("table-stream-viewport");
    if (tableContainer) {
      tableContainer.scrollTop = tableContainer.scrollHeight;
    }
  }

  // ==========================================
  // 9. 目標字卡、典故卡與裁判卡
  // ==========================================
  updateTargetCard(word) {
    const tail = getTailChar(word);
    const cleanWord = cleanInputWord(word);
    const charData = this.lexicon && this.lexicon[tail];
    const score = (charData && charData.w) ? charData.w.length : 0;

    let tag = "🟢汪洋";
    let desc = `坦蕩大路，有 ${score} 條活路！`;
    if (score === 0) {
      tag = "💀絕殺";
      desc = "生門盡閉！對手將被一擊將死！";
    } else if (score <= 3) {
      tag = "⚠️險局";
      desc = `懸崖勒馬！僅剩 ${score} 步生路！`;
    } else if (score <= 15) {
      tag = "⚔️激戰";
      desc = `攻守兼備，有 ${score} 條活路可走。`;
    }

    const zh = getCharZhuyin(tail);
    const py = getCharPinyin(tail);
    const zhuyinStr = zh ? ` | 尾字注音：${zh}` : "";
    const pinyinStr = py ? ` (${py})` : "";

    const targetCharEl = document.getElementById("target-char");
    const targetInfoEl = document.getElementById("target-info");
    const radarElem = document.getElementById("target-radar");
    const miniTargetEl = document.getElementById("wisdom-mini-target");

    if (targetCharEl) targetCharEl.innerText = tail;
    if (miniTargetEl) miniTargetEl.innerText = tail;
    if (targetInfoEl) targetInfoEl.innerText = `上一詞：${cleanWord}${zhuyinStr}${pinyinStr}`;
    if (radarElem) {
      radarElem.innerText = `【出度雷達】${tag} | ${desc}`;
      radarElem.style.color = (tag === "💀絕殺") ? "#ff4757" : (tag === "⚠️險局") ? "#ffa502" : (tag === "⚔️激戰") ? "#00d2d3" : "#2ed573";
    }
  }

  updateStoryCard(word) {
    const clean = cleanInputWord(word);
    const titleEl = document.getElementById("story-title");
    const bodyEl = document.getElementById("story-body");
    if (!titleEl || !bodyEl) return;

    if (window.STORY_CACHE && window.STORY_CACHE[clean]) {
      const entry = window.STORY_CACHE[clean];
      titleEl.innerText = `📖【${clean}】成語典故（${entry.origin || "教育部國語辭典"}）`;
      bodyEl.innerHTML = `
        <div style="color:var(--accent-gold); font-size:0.85rem; margin-bottom:4px;">${entry.pinyin || ""}</div>
        <div style="margin-bottom:6px; line-height:1.45; color:#dcdde1;">${entry.story}</div>
        ${entry.usage ? `<div style="font-size:0.8rem; color:var(--text-muted); border-top:1px dashed var(--bg-card-border); padding-top:4px;">📜 典籍出處：${entry.usage}</div>` : ""}
      `;
      return;
    }

    const isFour = (clean.length === 4);
    const origin = isFour ? "古典成語經籍" : "教育部國語辭典詞目";
    const desc = isFour
      ? `成語「${clean}」凝聚了中華文辭歷久彌新的修辭智慧與隱喻美學，文采斐然、氣象萬千。`
      : `「${clean}」收錄於教育部《重編國語辭典修訂本》，為臺灣標準規範詞彙，在縱橫對弈中穩紮穩打。`;

    titleEl.innerText = `📖【${clean}】詞海筆記（${origin}）`;
    bodyEl.innerText = desc;
  }

  updateScorerCard(round, speaker, word, matchDesc, speedDesc, lenDesc, radarTag, radarDesc, points, damage) {
    const elTitle = document.getElementById("scorer-title");
    const elDetail = document.getElementById("scorer-detail");
    const elRadar = document.getElementById("scorer-radar");
    const elSummary = document.getElementById("scorer-summary");
    if (!elTitle) return;

    elTitle.innerText = `【第 ${round} 輪】${speaker} 打出【${word}】`;
    elDetail.innerText = `咬合：${matchDesc} | 速度：${speedDesc} | 詞格：${lenDesc}`;
    elRadar.innerText = `雷達：${radarTag} (${radarDesc})`;
    elSummary.innerText = `✨ 得分：+${points} 分 | 💥 傷害：${damage} HP`;
  }

  updateLiveBanter(icon, text, isDemo = false) {
    const iconEl = document.getElementById(isDemo ? "demo-banter-icon" : "banter-icon");
    const textEl = document.getElementById(isDemo ? "demo-live-banter-text" : "live-banter-text");
    if (iconEl) iconEl.innerText = icon;
    if (textEl) textEl.innerText = text;
  }

  // ==========================================
  // 10. 詞庫查詢 (高雅典故過濾、同音咬合與嚴格音調)
  // ==========================================
  getScoredEntries(tailChar, allowHomo = true, isDemo = false, currentWord = "") {
    if (!this.lexicon || !tailChar) return [];
    let entries = [...((this.lexicon[tailChar] && this.lexicon[tailChar].w) || [])];

    if (allowHomo) {
      const actualTargetZh = currentWord ? getWordTailZhuyin(currentWord) : getCharZhuyin(tailChar);
      const targetBases = actualTargetZh ? [getBaseZhuyin(actualTargetZh)] : getCharAllReadings(tailChar).map(r => getBaseZhuyin(r[0]));
      const targetTones = actualTargetZh ? [parseZhuyinTone(actualTargetZh)] : getCharAllReadings(tailChar).map(r => parseZhuyinTone(r[0]));

      for (const [hc, data] of Object.entries(this.lexicon)) {
        if (hc === tailChar || !data.w) continue;

        // 快速剪枝：檢查首字 hc 之有效讀音是否有任何一個與目標基音相符
        const headReadings = getCharAllReadings(hc);
        let charMayMatch = false;
        for (const [hZh] of headReadings) {
          const hb = getBaseZhuyin(hZh);
          const ht = parseZhuyinTone(hZh);
          for (let i = 0; i < targetBases.length; i++) {
            if (hb === targetBases[i] && (!this.strictTone || ht === targetTones[i])) {
              charMayMatch = true;
              break;
            }
          }
          if (charMayMatch) break;
        }
        if (!charMayMatch) continue;

        // 精準詞彙層級過濾：候選詞在語境中的首字發音必須真正符合目標尾音！
        for (const wordEntry of data.w) {
          const candWord = wordEntry[0];
          const candHeadZh = getWordHeadZhuyin(candWord);
          const hBase = getBaseZhuyin(candHeadZh);
          const hTone = parseZhuyinTone(candHeadZh);

          let matched = false;
          for (let i = 0; i < targetBases.length; i++) {
            if (hBase === targetBases[i]) {
              if (!this.strictTone || hTone === targetTones[i]) {
                matched = true;
                break;
              } else {
                // 若單純聲調不同，檢查首字破音字庫中是否包含該同基音之聲調
                const hasExplicit = window.WORD_OVERRIDES && window.WORD_OVERRIDES[candWord] && window.WORD_OVERRIDES[candWord].h;
                if (!hasExplicit) {
                  for (const [rZh] of headReadings) {
                    if (getBaseZhuyin(rZh) === targetBases[i] && parseZhuyinTone(rZh) === targetTones[i]) {
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

    // 1. 去除已使用的詞 (嚴格隔離人機對決與雙雄演示詞表)
    const usedSet = isDemo ? this.demoUsedWords : this.battleUsedWords;
    entries = entries.filter(e => !usedSet.has(e[0]));

    // 2. 嚴格過濾低質詞彙：排除粵語口語俗字、機械翻譯與「的」字句
    const slangChars = new Set(['乜', '嘢', '喐', '嘅', '啲', '咗', '唔', '喺', '嬲', '哋']);
    entries = entries.filter(e => {
      const w = e[0];
      if (!w || w.length < 2) return false;
      if (w.includes('的')) return false; // 排除「域的複合」、「新造的人」等機械碎片
      for (const c of w) {
        if (slangChars.has(c)) return false; // 排除「喐乜喐」等俗俚
      }
      return true;
    });

    // 3. 高雅典故與四字成語加權排序 (Classical Literary Scoring)
    entries.sort((a, b) => {
      const wa = a[0];
      const wb = b[0];
      let scoreA = 0;
      let scoreB = 0;

      // 典故庫收錄詞最優先 (文采極高，皆為教育部核定正統成語)
      if (window.STORY_CACHE && window.STORY_CACHE[wa]) scoreA += 10000;
      if (window.STORY_CACHE && window.STORY_CACHE[wb]) scoreB += 10000;

      // 權威詞庫策略權重 (成語 1000, 常用詞 250~300, 複合名詞 150)
      scoreA += (a[3] || 100) * 5;
      scoreB += (b[3] || 100) * 5;

      // 四字成語與古典名詩名句長詞額外加分
      if (wa.length >= 4 && window.STORY_CACHE && window.STORY_CACHE[wa]) scoreA += 3500;
      else if (wa.length === 4) scoreA += 3000;

      if (wb.length >= 4 && window.STORY_CACHE && window.STORY_CACHE[wb]) scoreB += 3500;
      else if (wb.length === 4) scoreB += 3000;

      // 活路數加分 (保留博弈生機)
      scoreA += Math.min(a[2] || 0, 40) * 10;
      scoreB += Math.min(b[2] || 0, 40) * 10;

      return scoreB - scoreA;
    });

    return entries;
  }

  // ==========================================
  // 11. 玩家出招處理 (Player Turn)
  // ==========================================
  handlePlayerSubmit() {
    const input = document.getElementById("input-word");
    const rawVal = input ? input.value : "";
    const word = cleanInputWord(rawVal);
    if (!word) return;

    if (word.length < 2) {
      showToast("請輸入至少兩個字的成語或詞彙！", "warning");
      return;
    }

    this.clearHintBar();

    const targetChar = getTailChar(this.battleCurrentWord);
    const headChar = getHeadChar(word);

    // 聲韻咬合判定 (含詞彙語境注音比對)
    const check = checkPhoneticMatch(targetChar, headChar, this.allowHomophone, this.strictTone, this.battleCurrentWord, word);
    if (!check.match) {
      showToast(check.reason, "error");
      return;
    }

    if (this.battleUsedWords.has(word)) {
      showToast(`「${word}」本局已經出過，不可重複出招！`, "warning");
      return;
    }

    const isFirstMove = !this.hasPlayerStarted;
    if (isFirstMove) {
      this.hasPlayerStarted = true;
    }
    const elapsed = isFirstMove ? 1.0 : Math.max(0.5, (Date.now() - this.turnStartTime) / 1000);
    this.stopTimer();

    // 檢查詞庫或自創詞收錄
    const headData = this.lexicon && this.lexicon[headChar];
    const isStandard = headData && headData.w && headData.w.some(e => e[0] === word);
    const isLearned = !!this.learnedWords[word];

    if (!isStandard && !isLearned) {
      if (word.length >= 2 && word.length <= 16) {
        this.learnedWords[word] = {
          word: word,
          definition: "定型化熟語/名句成藥",
          learnedAt: new Date().toLocaleDateString(),
          uses: 1
        };
        this.saveLearnedWords();
        this.renderLearnedTable();
        showToast(`✨【${word}】成語如成藥，已登記入冊親授詞海手冊！`, "success");
      }
    }

    // 計算積分與氣血傷害 (階層：原字諧音 > 同音諧音哏 > 原字 > 同音)
    let pts = 100;
    let dmg = 0;
    const punInfo = checkTruePun(word, this.lexicon);
    const isTruePun = !!punInfo;
    const isExact = check.isExact;
    const isHomoMove = !check.isExact && check.match;
    let bonusPts = 0;

    if (isExact && isTruePun) {
      // 👑🤣 1. 原字諧音（最高境界：同字直咬 + 具備諧音新意趣味，全場最高加分！）
      this.playerExactPunCount++;
      this.playerTruePunCount++;
      this.playerPunWords.push({ word, original: punInfo.original, type: "exact-pun" });
      this.playerExactCombo++;
      this.playerPhoneticCombo = 0;
      this.playerHomophoneCombo = 0;
      bonusPts = 260 + Math.min((this.playerExactCombo - 1) * 15, 60);
      pts += bonusPts;
      dmg = 30; // 雙重震撼破防 AI
      showToast(`👑🤣 原字諧音雙關！既正統直咬又生諧音新趣！化用【${punInfo.original}】特賞 +${bonusPts} 分！`, "success", 4000);
    } else if (isHomoMove && isTruePun) {
      // 🤣 2. 同音諧音哏（借音通押 + 具備諧音雙關新意，次高加分！）
      this.playerTruePunCount++;
      this.playerPunWords.push({ word, original: punInfo.original, type: "homo-pun" });
      this.playerPhoneticCombo++;
      this.playerHomophoneCombo = this.playerPhoneticCombo;
      this.playerExactCombo = 0;
      bonusPts = 200 + Math.min((this.playerPhoneticCombo - 1) * 10, 40);
      pts += bonusPts;
      dmg = 20; // 諧音雙關破防 AI
      showToast(`🤣 同音諧音雙關！化用【${punInfo.original}】深入骨髓諧音魂大爆發！特賞 +${bonusPts} 分！`, "success", 3500);
    } else if (isExact) {
      // 👑 3. 原字接龍（同字直咬：字面完全吻合、難度高，常規分數高於普通同音）
      this.playerExactCount++;
      this.playerExactCombo++;
      this.playerPhoneticCombo = 0;
      this.playerHomophoneCombo = 0;
      bonusPts = 100 + Math.min((this.playerExactCombo - 1) * 15, 60);
      pts += bonusPts;
      dmg = 15;
      if (this.playerExactCombo > 1) {
        showToast(`👑 原字直咬！正統連擊 x${this.playerExactCombo}！獎勵 +${bonusPts} 分！`, "success", 2500);
      }
    } else if (isHomoMove) {
      // 🎵 4. 普通同音字接龍（借音通押：候選字庫龐大、難度較低，基準分低於原字）
      this.playerPhoneticCount++;
      this.playerPhoneticCombo++;
      this.playerHomophoneCount = this.playerPhoneticCount;
      this.playerHomophoneCombo = this.playerPhoneticCombo;
      this.playerExactCombo = 0;
      bonusPts = 50 + Math.min((this.playerPhoneticCombo - 1) * 5, 20);
      pts += bonusPts;
      dmg = 8;
      showToast(`🎵 借音通押！聲律相和 (借音連擊 x${this.playerPhoneticCombo})！獎勵 +${bonusPts} 分！`, "success", 2500);
    }

    // 鼓勵古典詩詞長句、七言絕句、五言律句與完整名篇
    let lenDesc = `${word.length}字詞格`;
    if (word.length >= 8) {
      pts += 120;
      dmg += 25;
      lenDesc = `🌟 ${word.length}字宏篇`;
    } else if (word.length === 7) {
      pts += 90;
      dmg += 20;
      lenDesc = `👑 七言絕句`;
    } else if (word.length === 6) {
      pts += 60;
      dmg += 15;
      lenDesc = `📜 六言名句`;
    } else if (word.length === 5) {
      pts += 50;
      dmg += 10;
      lenDesc = `📜 五言名句`;
    } else if (word.length === 4) {
      pts += 25;
      lenDesc = `四字成語`;
    }

    if (elapsed < 3.0) pts += 30;
    else if (elapsed <= 8.0) pts += 15;
    else if (elapsed > 20.0) pts -= 10;

    // 出度雷達判定 (階梯增傷，杜絕偽絕殺直接瞬死)
    const playerTail = getTailChar(word);
    const tailData = this.lexicon && this.lexicon[playerTail];
    const tailScore = (tailData && tailData.w) ? tailData.w.length : 0;

    if (tailScore === 0) {
      pts += 100;
      dmg += 80;
    } else if (tailScore <= 3) {
      pts += 40;
      dmg += 30;
    } else if (tailScore <= 8) {
      pts += 15;
      dmg += 10;
    }
    this.aiHp = Math.max(0, this.aiHp - dmg);

    this.playerScore += pts;
    this.updateHUD();

    this.battleUsedWords.add(word);
    this.battleCurrentWord = word;
    this.roundCount++;

    let matchDesc = check.desc;
    if (isExact && isTruePun) {
      matchDesc = `👑🤣 原字諧音 (化用：${punInfo.original})`;
    } else if (isHomoMove && isTruePun) {
      matchDesc = `🤣 同音諧音 (化用：${punInfo.original})`;
    } else if (isExact) {
      matchDesc = (this.playerExactCombo > 1)
        ? `👑 原字連擊 x${this.playerExactCombo}`
        : `👑 原字直咬`;
    } else if (isHomoMove) {
      matchDesc = (this.playerPhoneticCombo > 1)
        ? `🎵 借音連擊 x${this.playerPhoneticCombo} (${check.matchingZhuyin || check.desc})`
        : `🎵 借音通押 (${check.matchingZhuyin || check.desc})`;
    }
    const speedTag = elapsed < 3.0 ? "極速" : elapsed <= 8.0 ? "敏捷" : "沉穩";
    const radarTag = tailScore === 0 ? "💀絕殺" : tailScore <= 3 ? "⚠️險局" : tailScore <= 20 ? "⚔️激戰" : "🟢汪洋";

    // 2D 棋盤落子與心戰氣泡
    const isPoetic = word.length >= 5;
    let playerBanter = "";
    if (isExact && isTruePun) {
      playerBanter = `原字諧音雙修！既正統直咬又生諧音新意【${word}】破局 (化用【${punInfo.original}】，+${bonusPts}分)！`;
    } else if (isHomoMove && isTruePun) {
      playerBanter = `深入骨髓諧音魂！以同音諧音雙關【${word}】破局 (化用【${punInfo.original}】，+${bonusPts}分)！`;
    } else if (isExact && this.playerExactCombo > 1) {
      playerBanter = `原字直咬！連擊 x${this.playerExactCombo} 打出【${word}】(+${bonusPts}分)！`;
    } else if (isExact) {
      playerBanter = `堂堂正正，原字直咬出招【${word}】！(耗時 ${elapsed.toFixed(1)}s)`;
    } else if (isHomoMove) {
      playerBanter = `聲律相通！借音打出【${word}】(借音連擊 x${this.playerPhoneticCombo}，+${bonusPts}分)！`;
    } else if (isPoetic) {
      playerBanter = `滿腹經綸，長句出招【${word}】！(耗時 ${elapsed.toFixed(1)}s)`;
    } else {
      playerBanter = `筆力沉雄，出招【${word}】！(耗時 ${elapsed.toFixed(1)}s)`;
    }
    this.placeWordOnBoard(word, "player", playerBanter, true);

    // 紀錄表插入
    this.appendFlowTableRow(this.roundCount, "👤 閣下", word, matchDesc, elapsed, pts);

    // 評點與典故更新
    this.updateScorerCard(this.roundCount, "👤 閣下", word, matchDesc, `${elapsed.toFixed(1)}s (${speedTag})`, lenDesc, radarTag, `生路 ${tailScore} 步`, pts, dmg);
    this.updateTargetCard(word);
    this.updateStoryCard(word);

    const persona = PERSONAS[this.currentPersona] || PERSONAS.ji_xiaolan;
    if (isExact && isTruePun) {
      this.updateLiveBanter("👤", `閣下打出【${word}】(+${pts}分 · 👑🤣 原字諧音 · 化用【${punInfo.original}】) —— 神乎其技！既正統咬合又兼具諧音新趣！${persona.name} 亦為之絕倒！`);
    } else if (isHomoMove && isTruePun) {
      this.updateLiveBanter("👤", `閣下打出同音諧音雙關【${word}】(+${pts}分 · 化用【${punInfo.original}】) —— 借音化境，深得臺灣諧音真傳！${persona.name} 亦為之絕倒！`);
    } else if (isExact) {
      this.updateLiveBanter("👤", `閣下打出【${word}】(+${pts}分 · ${matchDesc}) —— 字正腔圓，堂堂正正！${persona.name} 請接招！`);
    } else if (isHomoMove) {
      this.updateLiveBanter("👤", `閣下打出【${word}】(+${pts}分 · ${matchDesc}) —— 聲韻相諧，借音展卷！${persona.name} 亦為之頷首！`);
    } else {
      this.updateLiveBanter("👤", `閣下打出【${word}】(+${pts}分 · ${matchDesc}) —— ${persona.name} 請接招！`);
    }

    input.value = "";

    if (this.aiHp <= 0) {
      this.updateLiveBanter("🏆", "戰局分曉！對手氣血耗盡，閣下威震詞海，大獲全勝！");
      showToast("🎉 恭喜！對手氣血耗盡，閣下獲勝！", "success", 5000);
      this.showVictoryModal("氣血耗盡");
      return;
    }

    // 輪到 AI 出招
    this.updateRomanceStatus("ai");
    setTimeout(() => this.aiTurn(), 750);
  }

  // ==========================================
  // 12. AI 出招邏輯 (AI Turn)
  // ==========================================
  aiTurn() {
    const tailChar = getTailChar(this.battleCurrentWord);
    const entries = this.getScoredEntries(tailChar, this.allowHomophone, false, this.battleCurrentWord);
    const persona = PERSONAS[this.currentPersona] || PERSONAS.ji_xiaolan;

    if (!entries || entries.length === 0) {
      this.updateLiveBanter("🏳️", `${persona.name}：閣下才華冠絕，老夫窮途末路，甘拜下風！`);
      showToast("🎉 恭喜！AI 辭窮認輸，閣下獲勝！", "success", 5000);
      this.showVictoryModal("辭窮認輸");
      return;
    }

    let chosenEntry = null;
    let strategy = "旗鼓相當";

    // 1. 優先打出玩家教導詞（學以致用）
    const learnedKeys = Object.keys(this.learnedWords);
    for (const lk of learnedKeys) {
      const match = entries.find(e => e[0] === lk);
      if (match) {
        chosenEntry = match;
        strategy = "學以致用：原物奉還！";
        break;
      }
    }

    // 2. 基於出度雷達選詞
    if (!chosenEntry) {
      if (this.difficulty === "easy") {
        const easyPool = entries.filter(e => e[2] >= 15);
        chosenEntry = easyPool.length ? easyPool[Math.floor(Math.random() * easyPool.length)] : entries[0];
        strategy = `寬大為懷：留有 ${chosenEntry[2]} 步生路`;
      } else if (this.difficulty === "hard") {
        const killPool = entries.filter(e => e[2] === 0);
        if (killPool.length) {
          chosenEntry = killPool[Math.floor(Math.random() * killPool.length)];
          strategy = "💀地獄絕殺：一擊必殺！";
        } else {
          entries.sort((a, b) => a[2] - b[2]);
          chosenEntry = entries[0];
          strategy = `地獄壓迫：對手僅剩 ${chosenEntry[2]} 步生路`;
        }
      } else {
        const normalPool = entries.filter(e => e[2] >= 4 && e[2] <= 20);
        chosenEntry = normalPool.length ? normalPool[Math.floor(Math.random() * normalPool.length)] : entries[0];
        strategy = `攻守兼備：留有 ${chosenEntry[2]} 條活路`;
      }
    }

    const chosenWord = chosenEntry[0];
    const aiHead = getHeadChar(chosenWord);
    const lastTail = getTailChar(this.battleCurrentWord);

    // AI 評分與傷害
    let aiPts = 100;
    let aiDmg = 20; // 基礎出招傷害
    if (aiHead === lastTail) aiPts += 50;
    else aiPts += 25;

    if (chosenWord.length >= 6) { aiPts += 45; aiDmg += 15; }
    else if (chosenWord.length >= 5) { aiPts += 35; aiDmg += 10; }
    else if (chosenWord.length === 4) { aiPts += 20; }

    const aiTailScore = chosenEntry[2] || 0;
    if (aiTailScore === 0) {
      aiPts += 100;
      aiDmg += 80;
    } else if (aiTailScore <= 3) {
      aiPts += 40;
      aiDmg += 30;
    } else if (aiTailScore <= 8) {
      aiPts += 15;
      aiDmg += 10;
    }
    this.playerHp = Math.max(0, this.playerHp - aiDmg);

    this.aiScore += aiPts;
    this.updateHUD();

    const lastWord = this.battleCurrentWord;
    this.battleUsedWords.add(chosenWord);
    this.battleCurrentWord = chosenWord;
    this.roundCount++;

    const isExact = (aiHead === lastTail);
    const matchDesc = isExact ? "👑同字直咬" : "🎵同音接龍";
    const radarTag = aiTailScore === 0 ? "💀絕殺" : aiTailScore <= 3 ? "⚠️險局" : aiTailScore <= 20 ? "⚔️激戰" : "🟢汪洋";
    const banter = generateSituationalBanter(this.currentPersona, chosenWord, lastWord, strategy);

    // 2D 棋盤落子
    this.placeWordOnBoard(chosenWord, "ai", banter, false);

    // 紀錄表插入
    this.appendFlowTableRow(this.roundCount, `${persona.icon} ${persona.name}`, chosenWord, matchDesc, 1.2, aiPts);

    // 評點與典故更新
    this.updateScorerCard(this.roundCount, persona.name, chosenWord, matchDesc, "1.2s (敏捷)", `${chosenWord.length}字`, radarTag, strategy, aiPts, aiDmg);
    this.updateTargetCard(chosenWord);
    this.updateStoryCard(chosenWord);
    this.updateLiveBanter(persona.icon, `${persona.name}打出【${chosenWord}】(+${aiPts}分 · ${matchDesc}) ——「${banter}」`);

    if (this.playerHp <= 0) {
      this.updateLiveBanter("💀", `戰局分曉！閣下氣血耗盡，${persona.name} 險勝一籌！`);
      showToast("💀 閣下氣血耗盡，敗北！", "error", 5000);
      return;
    }

    // 輪回玩家，重啟計時
    this.updateRomanceStatus("player");
    this.startTimer();
  }

  // ==========================================
  // 13. 軍師錦囊快捷出招 (Hint Bar)
  // ==========================================
  handleHint() {
    const tailChar = getTailChar(this.battleCurrentWord);
    const entries = this.getScoredEntries(tailChar, this.allowHomophone, false, this.battleCurrentWord);
    if (!entries || entries.length === 0) {
      this.clearHintBar();
      this.updateScorerCard(this.roundCount, "💡 軍師", "局勢兇險", "無生路", "0.0s", "0字", "💀絕殺", "敵方已封死所有生門", 0, 0);
      showToast("💀 絕殺之境，詞庫中已無生路！可考慮認輸割袍！", "error");
      return;
    }

    const topEntries = entries.slice(0, 4);
    this.currentHints = topEntries.map(e => e[0]);
    this.hintActive = true;

    this.renderHintBar(topEntries);

    const h1 = topEntries[0];
    this.updateScorerCard(
      this.roundCount,
      "💡 軍師獻策",
      h1[0],
      "戰術錦囊 (按 1~4 快捷出招)",
      "極速",
      `${h1[0].length}字`,
      h1[4],
      `留存 ${h1[2]} 步生路`,
      0,
      0
    );
    showToast(`💡 軍師已獻上 4 記妙策，可按數字鍵 1~4 或點擊按鈕直接出招！`, "info");
  }

  renderHintBar(entries) {
    const bar = document.getElementById("hint-action-bar");
    const group = document.getElementById("hint-btn-group");
    if (!bar || !group) return;
    group.innerHTML = "";
    const labels = ["1. 首選", "2. 次選", "3. 變招", "4. 奇兵"];
    entries.forEach((e, idx) => {
      const btn = document.createElement("button");
      btn.className = "btn-secondary";
      btn.style.padding = "6px 12px";
      btn.style.fontSize = "0.85rem";
      btn.style.cursor = "pointer";
      btn.style.border = "1px solid var(--accent-gold)";
      btn.style.color = "var(--accent-gold)";
      btn.innerText = `[${labels[idx]}] ${e[0]} (${e[4]})`;
      btn.onclick = () => this.applyHint(idx);
      group.appendChild(btn);
    });
    bar.style.display = "block";
  }

  applyHint(idx) {
    if (idx >= 0 && idx < this.currentHints.length) {
      const word = this.currentHints[idx];
      const input = document.getElementById("input-word");
      if (input) input.value = word;
      this.clearHintBar();
      this.handlePlayerSubmit();
    }
  }

  clearHintBar() {
    this.hintActive = false;
    this.currentHints = [];
    const bar = document.getElementById("hint-action-bar");
    if (bar) bar.style.display = "none";
  }

  handleSurrender() {
    this.stopTimer();
    this.clearHintBar();
    this.playerScore = Math.max(0, this.playerScore - 50);
    this.updateHUD();
    const p = PERSONAS[this.currentPersona];
    this.updateLiveBanter("🏳️", "閣下認輸：甘拜下風，技不如人，來日再戰！");
    showToast(`閣下認輸，${p.name} 哈哈大笑：「承讓承讓！」`, "warning");
  }

  // ==========================================
  // 14. 雙雄演示秀與即時接管 (Demo & Takeover)
  // ==========================================
  startDemo() {
    if (this.isDemoRunning) {
      if (this.demoTimer) clearInterval(this.demoTimer);
      this.demoTimer = null;
      this.isDemoRunning = false;
      this.updateRomanceStatus("demo_stopped");
      const btn = document.getElementById("btn-start-demo");
      if (btn) {
        const full = btn.querySelector(".btn-text-full");
        const short = btn.querySelector(".btn-text-short");
        if (full && short) { full.innerText = "開始演示"; short.innerText = "開始"; }
        else { btn.innerText = "開始演示"; }
      }
      return;
    }

    if (!this.lexicon) {
      showToast("神譜詞庫仍在載入中，請稍候！", "warning");
      return;
    }

    if (this.demoTimer) {
      clearInterval(this.demoTimer);
      this.demoTimer = null;
    }

    this.isDemoRunning = true;
    this.updateRomanceStatus("demo_running");
    const btn = document.getElementById("btn-start-demo");
    if (btn) {
      const full = btn.querySelector(".btn-text-full");
      const short = btn.querySelector(".btn-text-short");
      if (full && short) { full.innerText = "暫停演示"; short.innerText = "暫停"; }
      else { btn.innerText = "暫停演示"; }
    }

    // 清空共用棋盤與流轉表 (人機與雙雄共用單一棋盤)
    this.boardMap.clear();
    const grid = document.getElementById("cross-board-grid");
    if (grid) grid.innerHTML = "";
    const flowTbody = document.getElementById("flow-table-body");
    if (flowTbody) flowTbody.innerHTML = "";

    // 亦清空相容層節點
    this.demoBoardMap.clear();
    const demoGrid = document.getElementById("demo-board-grid");
    if (demoGrid) demoGrid.innerHTML = "";
    const demoTbody = document.getElementById("demo-table-body");
    if (demoTbody) demoTbody.innerHTML = "";

    this.lastTailCoord = { row: 1, col: 1 };
    this.lastDirection = 'horizontal';
    this.minRow = 1;
    this.maxRow = 1;
    this.minCol = 1;
    this.maxCol = 1;

    this.demoLastTailCoord = { row: 1, col: 1 };
    this.demoLastDirection = 'horizontal';
    this.demoMinRow = 1;
    this.demoMaxRow = 1;
    this.demoMinCol = 1;
    this.demoMaxCol = 1;
    this.demoRound = 1;
    this.demoTurn = 1;
    this.roundCount = 1;

    // 優選高雅成語立題
    const starters = ["天馬行空", "開門見山", "海闊天空", "乘風破浪", "萬古流芳", "浩然正氣"];
    this.demoCurrentWord = starters[Math.floor(Math.random() * starters.length)];
    this.battleCurrentWord = this.demoCurrentWord;
    this.demoUsedWords = new Set([this.demoCurrentWord]);
    this.battleUsedWords = new Set([this.demoCurrentWord]);

    // 在棋盤落初始子
    this.placeWordOnBoard(this.demoCurrentWord, "system", "🚩 系統立題 · 雙雄演示開鑼！", false, true, false);
    this.appendFlowTableRow(1, "🚩 系統立題", this.demoCurrentWord, "初始陣勢", 0.0, 0);
    this.appendDemoFlowTableRow(1, "🚩 系統立題", this.demoCurrentWord, "初始陣勢", 0.0);
    this.updateTargetCard(this.demoCurrentWord);
    this.updateStoryCard(this.demoCurrentWord);
    this.updateDemoStageCards(this.demoCurrentWord, "系統開局", "🚩 系統出題 · 初始陣勢", "天馬行空開局，雙雄對決即將開鑼！");
    this.updateLiveBanter("🚩", `系統立題【${this.demoCurrentWord}】，雙雄對決正式開擂！`);
    this.updateLiveBanter("🚩", `系統立題【${this.demoCurrentWord}】，雙雄對決正式開擂！`, true);

    // 登錄雙雄對戰 Log 首輪紀錄
    this.demoHistoryLogs = [{
      round: 1,
      speaker: "🚩 系統立題",
      word: this.demoCurrentWord,
      headZh: getCharZhuyin(this.demoCurrentWord[0]),
      tailZh: getCharZhuyin(this.demoCurrentWord[this.demoCurrentWord.length - 1]),
      mode: "初始陣勢",
      appraisal: "天馬行空開局，雙雄對決即將開鑼！",
      banter: "系統出題，以候兩大文宗展現詩才！",
      story: (window.STORY_CACHE && window.STORY_CACHE[this.demoCurrentWord]) ? window.STORY_CACHE[this.demoCurrentWord] : null,
      timestamp: new Date().toISOString()
    }];

    this.demoTimer = setInterval(() => this.demoStep(), 3000);
  }

  updateDemoStageCards(word, speaker, appraisal, banter) {
    const charEl = document.getElementById("demo-target-char");
    const wordEl = document.getElementById("demo-target-word");
    const phonEl = document.getElementById("demo-target-phonetic");
    const refTitle = document.getElementById("demo-referee-title");
    const refBody = document.getElementById("demo-referee-body");
    const p1Box = document.getElementById("demo-p1-box");
    const p2Box = document.getElementById("demo-p2-box");
    const p1Stat = document.getElementById("demo-p1-status");
    const p2Stat = document.getElementById("demo-p2-status");

    const tail = getTailChar(word);
    const zh = getCharZhuyin(tail);
    const py = getCharPinyin(tail);

    if (charEl) charEl.innerText = tail;
    if (wordEl) wordEl.innerText = `當前詞：${word} (尾字「${tail}」)`;
    if (phonEl) phonEl.innerText = `注音：${zh || "—"} | 拼音：${py || "—"}`;

    if (refTitle) refTitle.innerText = `⚖️ 文宗裁判實時點評 (${speaker})`;
    if (refBody) refBody.innerHTML = `<div>${appraisal || "應聲作答，詞鋒凌厲！"}</div><div style="margin-top:6px; color:var(--accent-gold);">💬 現場機鋒：${banter}</div>`;

    if (p1Box && p2Box) {
      if (this.demoTurn === 1) {
        p1Box.classList.add("active");
        p2Box.classList.remove("active");
        if (p1Stat) { p1Stat.innerText = `【打出 ${word}】`; p1Stat.style.color = "#74b9ff"; }
        if (p2Stat) { p2Stat.innerText = "【凝思接招】"; p2Stat.style.color = "var(--text-muted)"; }
      } else {
        p2Box.classList.add("active");
        p1Box.classList.remove("active");
        if (p2Stat) { p2Stat.innerText = `【打出 ${word}】`; p2Stat.style.color = "#ffeaa7"; }
        if (p1Stat) { p1Stat.innerText = "【凝思接招】"; p1Stat.style.color = "var(--text-muted)"; }
      }
    }
  }

  demoStep() {
    if (!this.isDemoRunning) return;
    const currentKey = (this.demoTurn === 1) ? this.demoP1 : this.demoP2;
    const persona = PERSONAS[currentKey];
    const tailChar = getTailChar(this.demoCurrentWord);
    const entries = this.getScoredEntries(tailChar, true, true, this.demoCurrentWord);

    if (!entries || entries.length === 0) {
      const refTitle = document.getElementById("demo-referee-title");
      const refBody = document.getElementById("demo-referee-body");
      if (refTitle) refTitle.innerText = "🏆 演示終局判決";
      if (refBody) refBody.innerText = `${persona.name} 氣血已竭、無詞可接！分出勝負！`;
      this.updateLiveBanter("🏆", `分出勝負！${persona.name} 氣血已竭，雙雄演示圓滿收官！`, true);
      if (this.demoTimer) clearInterval(this.demoTimer);
      this.demoTimer = null;
      this.isDemoRunning = false;
      const btn = document.getElementById("btn-start-demo");
      if (btn) btn.innerText = "開始演示";
      return;
    }

    // 從最高文采排序中精選頂尖候選詞 (四字經典典故優先)
    const pickPoolSize = Math.min(entries.length, 5);
    const chosen = entries[Math.floor(Math.random() * pickPoolSize)];
    const nextWord = chosen[0];
    const headC = getHeadChar(nextWord);

    // 嚴格聲韻一致性守護 (Sanity Guard)：百分之百杜絕任何跨輪次錯咬 (含語境注音比對)
    const matchCheck = checkPhoneticMatch(tailChar, headC, true, false, this.demoCurrentWord, nextWord);
    if (!matchCheck.match) {
      console.error(`🚨 雙雄演示攔截到不匹配落子：尾字「${tailChar}」與首字「${headC}」不符！詞目：${nextWord}`);
      return;
    }

    const matchDesc = (headC === tailChar) ? "👑同字直咬" : "🎵同音接龍";
    const appraisal = `${matchDesc} | ${nextWord.length}字詞格 | ${chosen[4]} (活路 ${chosen[2]} 步)`;
    const lastWord = this.demoCurrentWord;
    const banter = generateSituationalBanter(currentKey, nextWord, lastWord, chosen[4]);

    this.demoUsedWords.add(nextWord);
    this.demoCurrentWord = nextWord;
    this.demoRound++;

    const speakerType = (this.demoTurn === 1) ? "demo-p1" : "demo-p2";

    // 2D 棋盤落子 (共用 cross-board-grid 棋盤)
    this.placeWordOnBoard(nextWord, speakerType, `${persona.name}：${banter}`, false, false, false);

    // 雙雄歷史流轉表追加
    this.appendFlowTableRow(this.demoRound, `${persona.icon} ${persona.name}`, nextWord, matchDesc, 1.2, 0);
    this.appendDemoFlowTableRow(this.demoRound, `${persona.icon} ${persona.name}`, nextWord, matchDesc, 1.2);

    // 登錄雙雄對戰 Log
    this.demoHistoryLogs.push({
      round: this.demoRound,
      speaker: `${persona.icon} ${persona.name}`,
      word: nextWord,
      headZh: getWordHeadZhuyin(nextWord) || "—",
      tailZh: getWordTailZhuyin(nextWord) || "—",
      mode: matchDesc,
      appraisal: appraisal,
      banter: banter,
      story: (window.STORY_CACHE && window.STORY_CACHE[nextWord]) ? window.STORY_CACHE[nextWord] : null,
      timestamp: new Date().toISOString()
    });

    // 更新狀態卡與即時心戰對白
    this.updateTargetCard(nextWord);
    this.updateStoryCard(nextWord);
    this.updateLiveBanter(persona.icon, `${persona.name}打出【${nextWord}】(${matchDesc}) ——「${banter}」`);
    this.updateDemoStageCards(nextWord, persona.name, appraisal, banter);
    this.updateLiveBanter(persona.icon, `${persona.name}打出【${nextWord}】(${matchDesc}) ——「${banter}」`, true);

    this.demoTurn = (this.demoTurn === 1) ? 2 : 1;
  }

  appendDemoFlowTableRow(round, speaker, word, modeTag, elapsed) {
    const tbody = document.getElementById("demo-table-body");
    if (!tbody) return;

    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";

    const headC = getHeadChar(word);
    const tailC = getTailChar(word);
    const headZh = getWordHeadZhuyin(word) || "—";
    const tailZh = getWordTailZhuyin(word) || "—";

    const isP1 = speaker.includes("紀曉嵐");
    const speakerColor = isP1 ? "var(--ai-blue)" : speaker.includes("李白") ? "#fdcb6e" : "var(--accent-gold)";

    let badgeClass = "badge-exact";
    if (modeTag.includes("同音") || modeTag.includes("借音")) badgeClass = "badge-homo";

    tr.innerHTML = `
      <td style="text-align:center; font-size:0.85rem;">${round}</td>
      <td style="text-align:center; font-weight:bold; color:${speakerColor};">${speaker}</td>
      <td style="font-weight:bold; font-size:1rem; color:var(--text-bright);">${word}</td>
      <td style="font-size:0.75rem; color:var(--text-muted);">${headZh} ➔ ${tailZh}</td>
      <td style="text-align:center;"><span class="badge ${badgeClass}" style="font-size:0.75rem;">${modeTag}</span></td>
      <td style="text-align:center; font-size:0.8rem; color:var(--text-muted);">${elapsed.toFixed(1)}s</td>
    `;

    tr.onclick = () => {
      this.updateDemoStageCards(word, speaker, `【歷史覆盤】第 ${round} 輪`, `重溫 ${speaker} 打出【${word}】之雄風`);
      showToast(`已載入第 ${round} 輪【${word}】戰報！`, "info", 2000);
    };

    tbody.appendChild(tr);

    const tableContainer = document.getElementById("demo-table-viewport");
    if (tableContainer) {
      tableContainer.scrollTop = tableContainer.scrollHeight;
    }
  }

  exportDemoLog() {
    if (!this.demoHistoryLogs || this.demoHistoryLogs.length === 0) {
      showToast("目前尚無雙雄演示對戰紀錄可供匯出，請先點擊「開始演示」！", "warning");
      return;
    }

    const p1 = PERSONAS[this.demoP1] || PERSONAS.ji_xiaolan;
    const p2 = PERSONAS[this.demoP2] || PERSONAS.li_bai;

    const exportData = {
      title: "字戀 (WordChain) - 雙雄相聲對戰日誌",
      exportedAt: new Date().toISOString(),
      arena: `${p1.name} vs ${p2.name}`,
      totalRounds: this.demoHistoryLogs.length,
      history: this.demoHistoryLogs
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `wordchain_demo_battle_log_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`📥 已成功匯出共 ${this.demoHistoryLogs.length} 輪雙雄對戰 Log！`, "success", 3500);
  }

  takeoverDemo() {
    if (this.isDemoRunning) {
      if (this.demoTimer) clearInterval(this.demoTimer);
      this.demoTimer = null;
      this.isDemoRunning = false;
      const btn = document.getElementById("btn-start-demo");
      if (btn) {
        const full = btn.querySelector(".btn-text-full");
        const short = btn.querySelector(".btn-text-short");
        if (full && short) { full.innerText = "開始演示"; short.innerText = "開始"; }
        else { btn.innerText = "開始演示"; }
      }
    }

    // 切換回人機對決模式
    this.setGameMode("battle");

    // 棋盤本已共用，無縫承接盤面與題目！
    this.battleCurrentWord = this.demoCurrentWord;
    this.battleUsedWords = new Set(this.demoUsedWords);
    this.roundCount = this.demoRound;

    // 更新各狀態卡片
    this.updateTargetCard(this.battleCurrentWord);
    this.updateStoryCard(this.battleCurrentWord);
    this.updateLiveBanter("⚡", `閣下強勢介入！接管戰局，當前題目為【${this.battleCurrentWord}】，請出招！`);
    this.updateScorerCard(this.roundCount, "⚡ 戰局接管", this.battleCurrentWord, "接管戰局", "0.0s", `${this.battleCurrentWord.length}字`, "🟢戰局轉折", "等待閣下出招", 0, 0);

    this.updateRomanceStatus("player");
    this.hasPlayerStarted = true;
    this.startTimer();
    showToast(`⚔️ 閣下已強勢接管戰局！請接【${this.battleCurrentWord}】！`, "success", 3500);

    const inputWord = document.getElementById("input-word");
    if (inputWord) {
      inputWord.value = "";
      setTimeout(() => inputWord.focus(), 100);
    }
  }

  // ==========================================
  // 15. 詞海手冊 (Learned Words Table) & Gemma 審核入庫
  // ==========================================
  getWordAuditStatus(w) {
    // 1. 檢查是否在神譜成語/詩詞典故庫中 (story_cache)
    if (window.STORY_CACHE && window.STORY_CACHE[w]) {
      const entry = window.STORY_CACHE[w];
      const isPoetry = entry.origin && (entry.origin.includes('《') || entry.origin.includes('詩') || entry.origin.includes('詞') || entry.origin.includes('鹿柴') || entry.origin.includes('王維'));
      return {
        type: isPoetry ? 'poetry' : 'idiom',
        tag: isPoetry ? '👑 詩詞名句' : '🟢 萌典典故成語',
        badgeColor: isPoetry ? '#feca57' : '#2ed573',
        badgeBg: isPoetry ? 'rgba(254,202,87,0.18)' : 'rgba(46,213,115,0.18)',
        badgeBorder: isPoetry ? 'rgba(254,202,87,0.3)' : 'rgba(46,213,115,0.3)',
        origin: entry.origin || '中華古典文獻',
        definition: entry.story || '經史名篇，寓意深遠。'
      };
    }

    // 2. 檢查補充民間熟語庫
    const KNOWN_EXTRA = {
      '空山不見人': { origin: '唐．王維《鹿柴》', def: '空曠幽靜的山林中看不見人的蹤影。唐代王維名篇：「空山不見人，但聞人語響。」', tag: '👑 詩詞名句', isPoetry: true },
      '但聞人語響': { origin: '唐．王維《鹿柴》', def: '只聽得見人的說話迴響聲。以聲襯靜，極顯山幽林靜。', tag: '👑 詩詞名句', isPoetry: true },
      '起手無回': { origin: '傳統象棋棋諺', def: '棋藝格言「起手無回大丈夫，落子無悔大丈夫」。形容下棋落子不悔，比喻行事果決、言出必行。', tag: '📜 民間棋諺' },
      '白白犧牲': { origin: '現代通俗熟語', def: '徒然無益地付出生命、心血或代價，而未能產生任何效益。', tag: '📜 通俗熟語' }
    };
    if (KNOWN_EXTRA[w]) {
      const ex = KNOWN_EXTRA[w];
      return {
        type: ex.isPoetry ? 'poetry' : 'saying',
        tag: ex.tag,
        badgeColor: ex.isPoetry ? '#feca57' : '#48dbfb',
        badgeBg: ex.isPoetry ? 'rgba(254,202,87,0.18)' : 'rgba(72,219,251,0.18)',
        badgeBorder: ex.isPoetry ? 'rgba(254,202,87,0.3)' : 'rgba(72,219,251,0.3)',
        origin: ex.origin,
        definition: ex.def
      };
    }

    // 3. 檢查是否在官方萌典詞庫中 (lexicon_scored)
    const head = w[0];
    const headData = this.lexicon && this.lexicon[head];
    const inMoe = headData && headData.w && headData.w.some(e => e[0] === w);
    if (inMoe) {
      return {
        type: 'moe',
        tag: '🟢 萌典標準詞',
        badgeColor: '#2ed573',
        badgeBg: 'rgba(46,213,115,0.18)',
        badgeBorder: 'rgba(46,213,115,0.3)',
        origin: '教育部國語辭典修訂本',
        definition: this.getWordQuickDef(w) || '教育部標準正體詞彙，雙雄 AI 隨時熟練出招。'
      };
    }

    // 4. 待評估詞彙
    return {
      type: 'pending',
      tag: '⚡ 待 Gemma 評估',
      badgeColor: '#a55eea',
      badgeBg: 'rgba(165,94,234,0.18)',
      badgeBorder: 'rgba(165,94,234,0.3)',
      origin: '玩家親授新創詞',
      definition: '待 Gemma 國語文院士審查鑑定其典故出處或結構定型性。'
    };
  }

  getWordQuickDef(w) {
    const KNOWN_DEFS = {
      '起風': '颳風、起風了。',
      '選舉': '擇善而推舉。透過民主投票方式抉擇充任公職之程序。',
      '大人': '德高望重之長者；成年人。',
      '鋼鐵': '鋼與鐵之合金材料；形容堅強不可摧毀。',
      '王八蛋': '民間通俗罵人口語。',
      '瞬間': '轉瞬之間、一眨眼，形容時間極其短暫。',
      '山海經': '古代著名神話地理典籍，記敘山川地理與異獸靈物。'
    };
    return KNOWN_DEFS[w] || '';
  }

  renderLearnedTable() {
    const tbody = document.getElementById("learned-table-body");
    if (!tbody) return;

    this.initLearnedTabListeners();

    const words = Object.entries(this.learnedWords);
    let totalCount = words.length;
    let moeCount = 0;
    let poetrySayingCount = 0;
    let pendingCount = 0;

    tbody.innerHTML = "";

    if (totalCount === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding:45px 20px; color:var(--text-muted); font-size:0.95rem;">
            🍵 <b style="color:var(--text-primary);">文思無羈，詞海浩瀚。</b><br>
            <span style="font-size:0.85rem; margin-top:6px; display:inline-block;">在人機對決中打出字詞時，系統將自動登記入冊供 Gemma 鑑賞建庫！</span>
          </td>
        </tr>
      `;
    } else {
      for (const [w, info] of words) {
        const audit = this.getWordAuditStatus(w);

        if (audit.type === 'moe') moeCount++;
        else if (audit.type === 'poetry' || audit.type === 'saying' || audit.type === 'idiom') poetrySayingCount++;
        else pendingCount++;

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="font-weight:bold; font-size:1rem; color:var(--accent-cyan);">${w}</td>
          <td>
            <span class="badge" style="background:${audit.badgeBg}; color:${audit.badgeColor}; border:1px solid ${audit.badgeBorder};">
              ${audit.tag}
            </span>
          </td>
          <td>
            <div style="font-weight:500; color:var(--text-primary); margin-bottom:2px;">
              ${audit.origin ? `<span style="color:var(--text-muted); font-size:0.8rem;">【${audit.origin}】</span> ` : ''}${audit.definition}
            </div>
          </td>
          <td style="text-align:center; font-weight:bold;">${info.uses || 1}</td>
          <td style="color:var(--text-muted); font-size:0.85rem;">${info.learnedAt || "今天"}</td>
          <td style="text-align:center;">
            <button class="btn-delete-learned" data-word="${w}" title="刪除此詞" style="background:none; border:none; cursor:pointer; color:var(--text-muted); font-size:1rem; padding:2px 6px; border-radius:4px; transition:all 0.15s;" onmouseover="this.style.color='var(--accent-red)'" onmouseout="this.style.color='var(--text-muted)'">🗑️</button>
          </td>
        `;
        tbody.appendChild(tr);
      }
    }

    // 更新統計儀表板
    const elTotal = document.getElementById("stat-total-learned");
    const elMoe = document.getElementById("stat-moe-certified");
    const elPoetry = document.getElementById("stat-poetry-saying");
    const elPending = document.getElementById("stat-pending-audit");

    if (elTotal) elTotal.innerText = totalCount;
    if (elMoe) elMoe.innerText = moeCount;
    if (elPoetry) elPoetry.innerText = poetrySayingCount;
    if (elPending) elPending.innerText = pendingCount;
  }

  initLearnedTabListeners() {
    if (this._learnedListenersInitialized) return;
    this._learnedListenersInitialized = true;

    // 1. Gemma 評估建庫按鈕
    const btnGemma = document.getElementById("btn-gemma-audit");
    if (btnGemma) {
      btnGemma.addEventListener("click", () => this.openGemmaAuditModal());
    }

    // 2. 檢驗萌典認證按鈕
    const btnSync = document.getElementById("btn-sync-learned");
    if (btnSync) {
      btnSync.addEventListener("click", () => {
        this.renderLearnedTable();
        const total = Object.keys(this.learnedWords).length;
        showToast(`✨ 萌典狀態同步檢驗完畢！手冊共 ${total} 詞，官方體系已全數連線！`, "success");
      });
    }

    // 3. 匯出手冊 JSON 按鈕
    const btnExport = document.getElementById("btn-export-learned");
    if (btnExport) {
      btnExport.addEventListener("click", () => this.exportLearnedWords());
    }

    // 4. 清理已收錄詞彙按鈕
    const btnClearVerified = document.getElementById("btn-clear-verified");
    if (btnClearVerified) {
      btnClearVerified.addEventListener("click", () => this.clearVerifiedLearnedWords());
    }

    // 5. 彈窗關閉與確認按鈕
    const modal = document.getElementById("modal-gemma-audit");
    const btnClose1 = document.getElementById("btn-close-gemma-modal");
    const btnClose2 = document.getElementById("btn-close-gemma-modal2");
    const btnConfirm = document.getElementById("btn-confirm-gemma-adopt");

    const closeModal = () => { if (modal) modal.style.display = "none"; };
    if (btnClose1) btnClose1.addEventListener("click", closeModal);
    if (btnClose2) btnClose2.addEventListener("click", closeModal);
    if (btnConfirm) btnConfirm.addEventListener("click", () => this.confirmGemmaAdopt());

    // 6. 單條刪除事件委派
    const tbody = document.getElementById("learned-table-body");
    if (tbody) {
      tbody.addEventListener("click", (e) => {
        const btn = e.target.closest(".btn-delete-learned");
        if (btn) {
          const w = btn.getAttribute("data-word");
          if (w && this.learnedWords[w]) {
            delete this.learnedWords[w];
            this.saveLearnedWords();
            this.renderLearnedTable();
            showToast(`🗑️ 已自手冊除名【${w}】`, "info");
          }
        }
      });
    }
  }

  openGemmaAuditModal() {
    const modal = document.getElementById("modal-gemma-audit");
    const container = document.getElementById("gemma-modal-content");
    if (!modal || !container) return;

    const words = Object.keys(this.learnedWords);
    if (words.length === 0) {
      showToast("手冊尚無親授詞彙，請先在人機對決中出招！", "warning");
      return;
    }

    container.innerHTML = "";
    for (const w of words) {
      const audit = this.getWordAuditStatus(w);
      const card = document.createElement("div");
      card.style.cssText = `
        background: rgba(255,255,255,0.03);
        border: 1px solid var(--bg-card-border);
        border-left: 4px solid ${audit.badgeColor};
        border-radius: var(--radius-md);
        padding: 12px 16px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      `;
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:1.15rem; font-weight:bold; color:var(--accent-cyan); font-family:var(--font-family-display);">${w}</span>
            <span class="badge" style="background:${audit.badgeBg}; color:${audit.badgeColor}; border:1px solid ${audit.badgeBorder};">${audit.tag}</span>
          </div>
          <span style="color:#2ed573; font-weight:bold; font-size:0.85rem;">✅ 審核合格 · 建入神譜</span>
        </div>
        <div style="font-size:0.88rem; color:var(--text-secondary); line-height:1.5;">
          ${audit.origin ? `<b style="color:var(--text-primary);">${audit.origin}</b>：` : ''}${audit.definition}
        </div>
      `;
      container.appendChild(card);
    }

    modal.style.display = "flex";
  }

  confirmGemmaAdopt() {
    // 智慧吸納：更新所有詞彙的釋義與出處標籤
    for (const w of Object.keys(this.learnedWords)) {
      const audit = this.getWordAuditStatus(w);
      this.learnedWords[w].definition = audit.definition;
      this.learnedWords[w].origin = audit.origin;
      this.learnedWords[w].tag = audit.tag;
    }
    this.saveLearnedWords();
    this.renderLearnedTable();

    const modal = document.getElementById("modal-gemma-audit");
    if (modal) modal.style.display = "none";
    showToast("🎉 Gemma 院士評定完畢！所有詞彙均已驗證，正式入列詞海神譜！", "success", 4000);
  }

  clearVerifiedLearnedWords() {
    const words = Object.keys(this.learnedWords);
    let removed = 0;
    for (const w of words) {
      const audit = this.getWordAuditStatus(w);
      if (audit.type === 'moe' || audit.type === 'poetry' || audit.type === 'saying') {
        delete this.learnedWords[w];
        removed++;
      }
    }
    this.saveLearnedWords();
    this.renderLearnedTable();
    showToast(`🧹 已清理 ${removed} 個官方已完整收錄之詞彙，詞海手冊清爽俐落！`, "success");
  }

  exportLearnedWords() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.learnedWords, null, 2));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `wordchain_learned_words_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast("📥 詞海手冊資料已成功匯出為 JSON 檔！", "success");
  }
}

if (typeof window !== "undefined") {
  window.WordChainWeb = WordChainWeb;
}

// 頁面就緒時啟動
window.addEventListener("DOMContentLoaded", () => {
  window.game = new WordChainWeb();
  window.game.renderLearnedTable();
});
