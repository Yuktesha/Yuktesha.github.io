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

function checkPhoneticMatch(targetChar, headChar, allowHomo = true, strictTone = true) {
  if (!targetChar || !headChar) {
    return { match: false, reason: "字元無效！" };
  }

  if (targetChar === headChar) {
    const primaryZh = getCharZhuyin(targetChar);
    return { match: true, isExact: true, desc: "👑同字直咬", matchingZhuyin: primaryZh, targetZhuyin: primaryZh };
  }

  if (!allowHomo) {
    return { match: false, reason: `本局設定「僅限同字直咬」，首字必須為「${targetChar}」！` };
  }

  const targetReadings = getCharAllReadings(targetChar);
  const headReadings = getCharAllReadings(headChar);

  // 若兩字均有注音讀音資料 (全面支援破音字/多音字交叉對比)
  if (targetReadings.length > 0 && headReadings.length > 0) {
    let toneMismatchCandidate = null;

    // 優先 1：尋找「同音同調」完美咬合 (Exact tone & base match)
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

    // 次選 2：若未開嚴格同調，且有同音異調者通押 (Different tone match)
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

    // 若開了嚴格同調且只找到異調
    if (strictTone && toneMismatchCandidate) {
      const { tZh, tTone, hZh, hTone } = toneMismatchCandidate;
      return {
        match: false,
        reason: `開啟「嚴格同調」！「${targetChar}」為第 ${tTone} 聲 (${tZh})，而「${headChar}」為第 ${hTone} 聲 (${hZh})，聲調不符！`
      };
    }
  }

  // 備援：拼音比對 (正規化去除音標，古典罕見字寬容相容)
  const targetPyNorm = normalizePinyin(getCharPinyin(targetChar));
  const headPyNorm = normalizePinyin(getCharPinyin(headChar));
  if (targetPyNorm && headPyNorm && targetPyNorm === headPyNorm) {
    const tZh = getCharZhuyin(targetChar);
    const hZh = getCharZhuyin(headChar);
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

  const primaryTargetZh = getCharZhuyin(targetChar);
  const primaryHeadZh = getCharZhuyin(headChar);
  const headInfo = primaryHeadZh ? `「${headChar}」(${primaryHeadZh})` : `「${headChar}」`;
  const targetInfo = primaryTargetZh ? `「${targetChar}」(${primaryTargetZh})` : `「${targetChar}」`;

  return {
    match: false,
    reason: `首字${headInfo} 與目標${targetInfo} 聲韻不合！`
  };
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

    // 氣血與積分
    this.playerScore = 0;
    this.aiScore = 0;
    this.playerHp = 100;
    this.aiHp = 100;

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

  async loadLexicon() {
    // 1. 優先使用 script 標籤載入的全域變數 (保證 file:/// 與零延遲)
    if (window.LEXICON_SCORED) {
      this.lexicon = window.LEXICON_SCORED;
      this.zhuyinMap = window.ZHUYIN_MAP || {};
      const statusEl = document.getElementById("loading-status");
      if (statusEl) statusEl.innerText = "臺灣萌典詞庫已就緒 (14.7萬正體詞)";
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
      const statusEl = document.getElementById("loading-status");
      if (statusEl) statusEl.innerText = "臺灣萌典詞庫已就緒 (14.7萬正體詞)";
      this.startNewBattle();
    } catch (e) {
      console.error("Failed to load scored lexicon", e);
      const statusEl = document.getElementById("loading-status");
      if (statusEl) statusEl.innerText = "載入備援模式";
      this.startNewBattle();
    }
  }

  initDOM() {
    // 導航標籤頁切換
    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
        btn.classList.add("active");
        const target = btn.getAttribute("data-target");
        const targetPane = document.getElementById(target);
        if (targetPane) targetPane.classList.add("active");

        if (target === "tab-demo") {
          // 切換至雙雄演示：暫停人機對決倒數計時，避免在背景逾時強行出招
          this.stopTimer();
        } else if (target === "tab-battle") {
          // 切換回人機對決：若已起手且戰局仍在進行，才恢復計時
          if (this.hasPlayerStarted && this.playerHp > 0 && this.aiHp > 0 && !this.timerId) {
            this.startTimer();
          }
        }
      });
    });

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

    // 棋盤視圖切換 (盤 棋盤 vs 表 紀錄表 - 雙雄演示)
    const btnDemoViewBoard = document.getElementById("btn-demo-view-board");
    const btnDemoViewTable = document.getElementById("btn-demo-view-table");
    const demoBoardViewport = document.getElementById("demo-board-viewport");
    const demoTableViewport = document.getElementById("demo-table-viewport");

    if (btnDemoViewBoard && btnDemoViewTable) {
      btnDemoViewBoard.addEventListener("click", () => {
        btnDemoViewBoard.classList.add("active");
        btnDemoViewTable.classList.remove("active");
        if (demoBoardViewport) demoBoardViewport.style.display = "block";
        if (demoTableViewport) demoTableViewport.style.display = "none";
      });

      btnDemoViewTable.addEventListener("click", () => {
        btnDemoViewTable.classList.add("active");
        btnDemoViewBoard.classList.remove("active");
        if (demoBoardViewport) demoBoardViewport.style.display = "none";
        if (demoTableViewport) demoTableViewport.style.display = "block";
      });
    }

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
      btnVicShare.addEventListener("click", () => {
        const rank = document.getElementById("vic-rank-pill")?.innerText || "完美字戀狂";
        const text = `📜【字戀 (WordChain) 勝戰捷報】\n` +
          `我以「${rank.replace('🏅 榮譽頭銜：', '').trim()}」之姿橫掃文壇，讓大文豪甘拜下風！\n` +
          `• 累積戰分：${this.playerScore} 分\n` +
          `• 對弈回合：${this.roundCount} 輪\n` +
          `• 終局題目：【${this.battleCurrentWord}】\n` +
          `敢問閣下——您今天字戀了沒？\n` +
          `👉 立即入陣：https://yuktesha.github.io/wordchain/`;
        navigator.clipboard.writeText(text).then(() => {
          showToast("📋 戰報已複製到剪貼簿！快去宣揚閣下的字戀之魂！", "success", 3500);
        }).catch(() => {
          showToast("📋 請手動複製分享戰報！", "info");
        });
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

    // 統計最長出招與最速反應
    let bestWord = this.battleCurrentWord;
    let maxLen = this.battleCurrentWord.length;
    let minElapsed = 99.0;
    const rows = document.querySelectorAll("#flow-table-body tr");
    rows.forEach(r => {
      const sp = r.children[1] ? r.children[1].innerText : "";
      const w = r.children[2] ? r.children[2].innerText : "";
      const elText = r.children[4] ? r.children[4].innerText : "";
      if (sp.includes("閣下") && w) {
        if (w.length > maxLen) {
          maxLen = w.length;
          bestWord = w;
        }
        const el = parseFloat(elText);
        if (!isNaN(el) && el < minElapsed) minElapsed = el;
      }
    });

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
      lEl.innerHTML = `<span style="white-space:nowrap;">${bestWord}</span><span style="font-size:0.75em; opacity:0.85; margin-left:3px; white-space:nowrap;">(${maxLen}字)</span>`;
    }

    const sEl = document.getElementById("vic-speed");
    if (sEl) sEl.innerText = speedStr;

    const scEl = document.getElementById("vic-score");
    if (scEl) scEl.innerText = this.playerScore;

    const pEl = document.getElementById("vic-rank-pill");
    if (pEl) pEl.innerText = `🏅 榮譽頭銜：${rankTitle}`;

    modal.style.display = "flex";
    this.updateRomanceStatus("victory");
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

    if (pScoreEl) pScoreEl.innerText = `👤 閣下: ${this.playerHp} HP | 積分: ${this.playerScore}`;
    if (aiScoreEl) aiScoreEl.innerText = `${persona.icon} ${persona.name}: ${this.aiHp} HP | 積分: ${this.aiScore}`;
    if (pBar) pBar.style.width = `${Math.max(0, this.playerHp)}%`;
    if (aiBar) aiBar.style.width = `${Math.max(0, this.aiHp)}%`;
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
    this.playerHp = Math.max(0, this.playerHp - 15);
    this.updateHUD();

    showToast("答題超時！自損 15 HP，扣除 30 積分！軍師強行接管！", "warning");

    if (this.playerHp <= 0) {
      showToast("💀 氣血耗盡，閣下落敗！", "error");
      return;
    }

    const tail = getTailChar(this.battleCurrentWord);
    const entries = this.getScoredEntries(tail, this.allowHomophone, false);
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

    // 重置氣血與積分
    this.playerHp = 100;
    this.aiHp = 100;
    this.playerScore = 0;
    this.aiScore = 0;
    this.updateHUD();

    // 清空棋盤與表格
    this.boardMap.clear();
    const grid = document.getElementById("cross-board-grid");
    if (grid) grid.innerHTML = "";
    const flowTbody = document.getElementById("flow-table-body");
    if (flowTbody) flowTbody.innerHTML = "";

    this.lastTailCoord = { row: 4, col: 3 };
    this.lastDirection = 'horizontal';
    this.minRow = 4;
    this.maxRow = 4;
    this.minCol = 3;
    this.maxCol = 3;

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
      // 初始詞：從 (4, 3) 橫向排開
      const startRow = 4;
      const startCol = 3;
      for (let i = 0; i < L; i++) {
        const r = startRow;
        const c = startCol + i;
        const ch = chars[i];
        const zh = getCharZhuyin(ch);
        boardMap.set(`${r},${c}`, { char: ch, speaker: speakerType, zhuyin: zh, isPivot: false });
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
          prevData.char = chars[0];
          prevData.nextChar = chars[0];
          const matchResult = checkPhoneticMatch(prevChar, chars[0], true, false);
          if (matchResult && matchResult.matchingZhuyin) {
            prevData.matchingZhuyin = matchResult.matchingZhuyin;
          }
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
          boardMap.set(`${r},${c}`, { char: ch, speaker: speakerType, zhuyin: zh, isPivot: false });
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
          boardMap.set(`${r},${c}`, { char: ch, speaker: speakerType, zhuyin: zh, isPivot: false });
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

    // 清理舊氣泡：僅保留至多 1 個前輪氣泡淡化，其餘全部移除，杜絕遮擋堆疊
    const oldBubbles = Array.from(grid.querySelectorAll(".board-bubble"));
    while (oldBubbles.length > 1) {
      const b = oldBubbles.shift();
      if (b && b.parentNode) b.parentNode.removeChild(b);
    }
    if (oldBubbles.length === 1) {
      oldBubbles[0].style.opacity = "0.28";
      oldBubbles[0].style.pointerEvents = "none";
    }

    // 在當前落子處生成對弈氣泡 (透過 findClearBubblePosition 智能避開已佔格)
    let bubblePos = null;
    if (banterText) {
      const isEven = isDemo ? (this.demoRound % 2 === 0) : (this.roundCount % 2 === 0);
      const curDir = isDemo ? this.demoLastDirection : this.lastDirection;
      bubblePos = this.findClearBubblePosition(boardMap, placedCoords, isEven, curDir);

      const bubble = document.createElement("div");
      bubble.className = `board-bubble ${bubblePos.arrowClass}`;
      bubble.style.left = `${bubblePos.bLeft}px`;
      bubble.style.top = `${bubblePos.bTop}px`;
      bubble.innerText = banterText;
      grid.appendChild(bubble);
    }

    // 平滑滾動視窗聚焦於最新落子與氣泡處 (預留 90px 舒適呼吸空間，徹底避免貼邊或切字)
    const viewport = document.getElementById(viewportId);
    if (viewport) {
      let minX = Math.min(...placedCoords.map(p => p.col * 44));
      let maxX = Math.max(...placedCoords.map(p => (p.col + 1) * 44));
      let minY = Math.min(...placedCoords.map(p => p.row * 44));
      let maxY = Math.max(...placedCoords.map(p => (p.row + 1) * 44));

      if (bubblePos) {
        minX = Math.min(minX, bubblePos.bLeft);
        maxX = Math.max(maxX, bubblePos.bLeft + 220);
        minY = Math.min(minY, bubblePos.bTop);
        maxY = Math.max(maxY, bubblePos.bTop + 56);
      }

      // 預留 90px 呼吸邊距
      const PADDING = 90;
      const roiMinX = Math.max(0, minX - PADDING);
      const roiMaxX = maxX + PADDING;
      const roiMinY = Math.max(0, minY - PADDING);
      const roiMaxY = maxY + PADDING;

      // 計算目標置中滾動位置 (延遲 40ms 等待 DOM 排版與彈性盒尺寸穩定，確保精準平滑居中)
      setTimeout(() => {
        const centerX = (roiMinX + roiMaxX) / 2;
        const centerY = (roiMinY + roiMaxY) / 2;
        const targetScrollLeft = Math.max(0, centerX - (viewport.clientWidth / 2));
        const targetScrollTop = Math.max(0, centerY - (viewport.clientHeight / 2));

        viewport.scrollTo({
          left: targetScrollLeft,
          top: targetScrollTop,
          behavior: "smooth"
        });
      }, 40);
    }
  }

  // ==========================================
  // 7.1 同音不同字呈現系統 (A: 合璧磚 / B: 音律橋 / C: 翻轉與滑動牌)
  // ==========================================
  renderHomoCell(cell, cellData) {
    const prevC = cellData.prevChar;
    const nextC = cellData.char;
    const matchCheck = (prevC && nextC) ? checkPhoneticMatch(prevC, nextC, true, false) : null;
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
    const headZh = getCharZhuyin(headC) || "—";
    const tailZh = getCharZhuyin(tailC) || "—";

    const isP = speaker.includes("閣下") || speaker.includes("軍師");
    const speakerColor = isP ? "var(--player-pink)" : "var(--ai-blue)";

    let badgeClass = "badge-exact";
    if (modeTag.includes("同音")) badgeClass = "badge-homo";
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

    if (targetCharEl) targetCharEl.innerText = tail;
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
  getScoredEntries(tailChar, allowHomo = true, isDemo = false) {
    if (!this.lexicon || !tailChar) return [];
    let entries = [...((this.lexicon[tailChar] && this.lexicon[tailChar].w) || [])];

    if (allowHomo) {
      const targetReadings = getCharAllReadings(tailChar);
      for (const [hc, data] of Object.entries(this.lexicon)) {
        if (hc === tailChar || !data.w) continue;
        const headReadings = getCharAllReadings(hc);
        let matched = false;

        if (targetReadings.length > 0 && headReadings.length > 0) {
          for (const [tZh] of targetReadings) {
            const tBase = getBaseZhuyin(tZh);
            const tTone = parseZhuyinTone(tZh);
            for (const [hZh] of headReadings) {
              const hBase = getBaseZhuyin(hZh);
              const hTone = parseZhuyinTone(hZh);
              if (tBase && hBase && tBase === hBase) {
                if (!this.strictTone || tTone === hTone) {
                  matched = true;
                  break;
                }
              }
            }
            if (matched) break;
          }
        } else {
          const targetPy = getCharPinyin(tailChar).toLowerCase();
          if (data.py && data.py.toLowerCase() === targetPy) {
            matched = true;
          }
        }

        if (matched) {
          entries.push(...data.w);
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

    // 聲韻咬合判定
    const check = checkPhoneticMatch(targetChar, headChar, this.allowHomophone, this.strictTone);
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

    // 計算積分與氣血傷害
    let pts = 100;
    let dmg = 0;
    if (check.isExact) pts += 50;
    else pts += 25;

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

    // 出度雷達判定
    const playerTail = getTailChar(word);
    const tailData = this.lexicon && this.lexicon[playerTail];
    const tailScore = (tailData && tailData.w) ? tailData.w.length : 0;

    if (tailScore === 0) {
      pts += 100;
      dmg = 100;
      this.aiHp = 0;
    } else if (tailScore <= 3) {
      pts += 40;
      dmg += 30;
      this.aiHp = Math.max(0, this.aiHp - dmg);
    } else if (tailScore <= 8) {
      pts += 15;
      dmg += 5;
      this.aiHp = Math.max(0, this.aiHp - dmg);
    } else {
      this.aiHp = Math.max(0, this.aiHp - dmg);
    }

    this.playerScore += pts;
    this.updateHUD();

    this.battleUsedWords.add(word);
    this.battleCurrentWord = word;
    this.roundCount++;

    const matchDesc = check.desc;
    const speedTag = elapsed < 3.0 ? "極速" : elapsed <= 8.0 ? "敏捷" : "沉穩";
    const radarTag = tailScore === 0 ? "💀絕殺" : tailScore <= 3 ? "⚠️險局" : tailScore <= 20 ? "⚔️激戰" : "🟢汪洋";

    // 2D 棋盤落子與心戰氣泡
    const isPoetic = word.length >= 5;
    const playerBanter = isPoetic
      ? `滿腹經綸，長句出招【${word}】！(耗時 ${elapsed.toFixed(1)}s)`
      : `筆力沉雄，出招【${word}】！(耗時 ${elapsed.toFixed(1)}s)`;
    this.placeWordOnBoard(word, "player", playerBanter, true);

    // 紀錄表插入
    this.appendFlowTableRow(this.roundCount, "👤 閣下", word, matchDesc, elapsed, pts);

    // 評點與典故更新
    this.updateScorerCard(this.roundCount, "👤 閣下", word, matchDesc, `${elapsed.toFixed(1)}s (${speedTag})`, lenDesc, radarTag, `生路 ${tailScore} 步`, pts, (this.aiHp <= 0 ? 100 : dmg));
    this.updateTargetCard(word);
    this.updateStoryCard(word);
    this.updateLiveBanter("👤", `閣下：${isPoetic ? '長歌當哭打出' : '筆力沉雄打出'}【${word}】，請接招！`);

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
    const entries = this.getScoredEntries(tailChar, this.allowHomophone, false);
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
    let aiDmg = 0;
    if (aiHead === lastTail) aiPts += 50;
    else aiPts += 25;

    if (chosenWord.length >= 5) { aiPts += 35; aiDmg += 5; }
    else if (chosenWord.length === 4) { aiPts += 20; }

    const aiTailScore = chosenEntry[2] || 0;
    if (aiTailScore === 0) {
      aiPts += 100;
      aiDmg = 100;
      this.playerHp = 0;
    } else if (aiTailScore <= 3) {
      aiPts += 40;
      aiDmg += 30;
      this.playerHp = Math.max(0, this.playerHp - aiDmg);
    } else if (aiTailScore <= 8) {
      aiPts += 15;
      aiDmg += 5;
      this.playerHp = Math.max(0, this.playerHp - aiDmg);
    } else {
      this.playerHp = Math.max(0, this.playerHp - aiDmg);
    }

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
    this.updateScorerCard(this.roundCount, persona.name, chosenWord, matchDesc, "1.2s (敏捷)", `${chosenWord.length}字`, radarTag, strategy, aiPts, (this.playerHp <= 0 ? 100 : aiDmg));
    this.updateTargetCard(chosenWord);
    this.updateStoryCard(chosenWord);
    this.updateLiveBanter(persona.icon, `${persona.name}：${banter}`);

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
    const entries = this.getScoredEntries(tailChar, this.allowHomophone, false);
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
      if (btn) btn.innerText = "開始演示";
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
    if (btn) btn.innerText = "暫停演示";

    // 清空雙雄 demo 棋盤與流轉表
    this.demoBoardMap.clear();
    const demoGrid = document.getElementById("demo-board-grid");
    if (demoGrid) demoGrid.innerHTML = "";
    const demoTbody = document.getElementById("demo-table-body");
    if (demoTbody) demoTbody.innerHTML = "";

    this.demoLastTailCoord = { row: 4, col: 3 };
    this.demoLastDirection = 'horizontal';
    this.demoMinRow = 4;
    this.demoMaxRow = 4;
    this.demoMinCol = 3;
    this.demoMaxCol = 3;
    this.demoRound = 1;
    this.demoTurn = 1;

    // 優選高雅成語立題
    const starters = ["天馬行空", "開門見山", "海闊天空", "乘風破浪", "萬古流芳", "浩然正氣"];
    this.demoCurrentWord = starters[Math.floor(Math.random() * starters.length)];
    this.demoUsedWords = new Set([this.demoCurrentWord]);

    // 在 demo 棋盤落初始子
    this.placeWordOnBoard(this.demoCurrentWord, "system", "🚩 系統立題 · 雙雄演示開鑼！", false, true, true);
    this.appendDemoFlowTableRow(1, "🚩 系統立題", this.demoCurrentWord, "初始陣勢", 0.0);
    this.updateDemoStageCards(this.demoCurrentWord, "系統開局", "🚩 系統出題 · 初始陣勢", "天馬行空開局，雙雄對決即將開鑼！");
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
    const entries = this.getScoredEntries(tailChar, true, true);

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

    // 嚴格聲韻一致性守護 (Sanity Guard)：百分之百杜絕任何跨輪次錯咬
    const matchCheck = checkPhoneticMatch(tailChar, headC, true, false);
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

    // 2D 棋盤落子 (啟用空間避障氣泡)
    this.placeWordOnBoard(nextWord, speakerType, `${persona.name}：${banter}`, false, false, true);

    // 雙雄歷史流轉表追加
    this.appendDemoFlowTableRow(this.demoRound, `${persona.icon} ${persona.name}`, nextWord, matchDesc, 1.2);

    // 登錄雙雄對戰 Log
    this.demoHistoryLogs.push({
      round: this.demoRound,
      speaker: `${persona.icon} ${persona.name}`,
      word: nextWord,
      headZh: getCharZhuyin(headC) || "—",
      tailZh: getCharZhuyin(getTailChar(nextWord)) || "—",
      mode: matchDesc,
      appraisal: appraisal,
      banter: banter,
      story: (window.STORY_CACHE && window.STORY_CACHE[nextWord]) ? window.STORY_CACHE[nextWord] : null,
      timestamp: new Date().toISOString()
    });

    // 更新狀態卡與即時心戰對白
    this.updateDemoStageCards(nextWord, persona.name, appraisal, banter);
    this.updateLiveBanter(persona.icon, `${persona.name}：${banter}`, true);

    this.demoTurn = (this.demoTurn === 1) ? 2 : 1;
  }

  appendDemoFlowTableRow(round, speaker, word, modeTag, elapsed) {
    const tbody = document.getElementById("demo-table-body");
    if (!tbody) return;

    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";

    const headC = getHeadChar(word);
    const tailC = getTailChar(word);
    const headZh = getCharZhuyin(headC) || "—";
    const tailZh = getCharZhuyin(tailC) || "—";

    const isP1 = speaker.includes("紀曉嵐");
    const speakerColor = isP1 ? "var(--ai-blue)" : speaker.includes("李白") ? "#fdcb6e" : "var(--accent-gold)";

    let badgeClass = "badge-exact";
    if (modeTag.includes("同音")) badgeClass = "badge-homo";

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
      if (btn) btn.innerText = "開始演示";
    }

    // 切換回 Tab 1 人機對決
    const tabBattleBtn = document.querySelector('[data-target="tab-battle"]');
    if (tabBattleBtn) tabBattleBtn.click();

    // 完整繼承雙雄戰局盤面與詞語狀態！
    this.boardMap = new Map(this.demoBoardMap);
    this.lastTailCoord = { ...this.demoLastTailCoord };
    this.lastDirection = this.demoLastDirection;
    this.minRow = this.demoMinRow;
    this.maxRow = this.demoMaxRow;
    this.minCol = this.demoMinCol;
    this.maxCol = this.demoMaxCol;
    this.roundCount = this.demoRound;

    this.battleCurrentWord = this.demoCurrentWord;
    this.battleUsedWords = new Set(this.demoUsedWords);

    // 將 demo-board-grid 內容遷移複製到 cross-board-grid
    const grid = document.getElementById("cross-board-grid");
    const demoGrid = document.getElementById("demo-board-grid");
    if (grid && demoGrid) {
      grid.innerHTML = demoGrid.innerHTML;
      grid.style.width = demoGrid.style.width;
      grid.style.height = demoGrid.style.height;
      Array.from(grid.querySelectorAll("[id^='demo-cell-']")).forEach(el => {
        el.id = el.id.replace("demo-cell-", "cell-");
      });
    }

    // 將 demo 流轉表同步到 Tab 1 流轉表
    const flowTbody = document.getElementById("flow-table-body");
    const demoTbody = document.getElementById("demo-table-body");
    if (flowTbody && demoTbody) {
      flowTbody.innerHTML = demoTbody.innerHTML;
    }

    // 更新各狀態卡片
    this.updateTargetCard(this.battleCurrentWord);
    this.updateStoryCard(this.battleCurrentWord);
    this.updateLiveBanter("⚡", `閣下強勢介入！接管戰局，當前題目為【${this.battleCurrentWord}】，請出招！`);
    this.updateScorerCard(this.roundCount, "⚡ 戰局接管", this.battleCurrentWord, "接管戰局", "0.0s", `${this.battleCurrentWord.length}字`, "🟢戰局轉折", "等待閣下出招", 0, 0);

    this.updateRomanceStatus("player");
    this.startTimer();
    showToast(`⚔️ 閣下已強勢接管戰局！請接【${this.battleCurrentWord}】！`, "success", 3500);
  }

  // ==========================================
  // 15. 詞海手冊 (Learned Words Table)
  // ==========================================
  renderLearnedTable() {
    const tbody = document.getElementById("learned-table-body");
    if (!tbody) return;
    tbody.innerHTML = "";
    for (const [w, info] of Object.entries(this.learnedWords)) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="font-weight:bold; color:var(--accent-cyan);">${w}</td>
        <td>${info.definition || "玩家自創新詞"}</td>
        <td style="text-align:center;">${info.uses || 1}</td>
        <td>${info.learnedAt || "今天"}</td>
      `;
      tbody.appendChild(tr);
    }
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
