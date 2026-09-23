/**
 * 字戀 (WordChain) - [主控總綱] 核心戰局狀態機 (Web Core Orchestrator)
 * 臺灣正體 · 文壇縱橫二維交錯字陣 · 漢字聲韻博弈
 * 
 * 架構章節導覽：
 * [第一章] 音韻與諧音演算法：js/phonetics.js (注音聲調、同音同調、臺灣特有諧音雙關)
 * [第二章] 歷代文風與心戰喊話：js/personas.js (紀曉嵐、李白、包拯個性矩陣與情境機鋒)
 * [第三章] 詞海八字 · 職業神算：js/career.js (從業向量分析、臺灣科學園區彩蛋)
 * [第四章] 二維縱橫字陣佈局：js/board.js (2D 十字落子、氣泡避障、三種同音格渲染)
 * [第五章] 攝影鏡頭與光學縮放：js/viewport.js (平滑光學變焦、4K自適應、面板拖曳)
 * [第六章] 詞庫檢索與 AI 決策：js/ai.js (候選詞加權檢索、難度調控、文采化劍氣、軍師錦囊)
 * [第七章] 4K 印刷戰報與向量匯出：js/victory.js (Canvas 2D 4K 圖卡、SVG、PDF 匯出)
 * [第八章] 詞海手冊與 Gemma 審定：js/learned.js (動態審定、手冊維護、一鍵吸納入庫)
 */

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
    this.playerExactCount = 0;    // 原字直咬累計
    this.playerExactCombo = 0;    // 原字直咬連擊數
    this.playerTruePunCount = 0;  // 臺灣諧音雙關梗累計
    this.playerExactPunCount = 0; // 原字諧音雙關累計
    this.playerPunWords = [];
    this.playerHomophoneCount = 0;
    this.playerHomophoneCombo = 0;
    this.lastHomoBadge = "";
    this.lastBadgeType = "";
    this.lastBestWord = "";
    this.lastBestLen = 0;

    // 計時器
    this.timeLimit = 30;
    this.timerSecondsLeft = 30;
    this.timerId = null;
    this.turnStartTime = Date.now();
    this.hasPlayerStarted = false;

    // 棋盤狀態 (2D Cross-Grid)
    this.boardMap = new Map();
    this.lastTailCoord = { row: 1, col: 1 };
    this.lastDirection = 'horizontal';
    this.minRow = 1;
    this.maxRow = 1;
    this.minCol = 1;
    this.maxCol = 1;
    let savedStyle = "tile";
    try { savedStyle = localStorage.getItem("wordchain_homo_style") || "tile"; } catch {}
    this.homoStyle = savedStyle; // 'tile' (A), 'bridge' (B), 'flip' (C)

    // 雙雄演示狀態
    this.isDemoRunning = false;
    this.demoTimer = null;
    this.demoTurn = 1;
    this.demoP1 = "ji_xiaolan";
    this.demoP2 = "li_bai";
    this.demoRound = 1;
    this.demoBoardMap = new Map();
    this.demoLastTailCoord = { row: 1, col: 1 };
    this.demoLastDirection = 'horizontal';
    this.demoMinRow = 1;
    this.demoMaxRow = 1;
    this.demoMinCol = 1;
    this.demoMaxCol = 1;
    this.demoHistoryLogs = [];

    // 自學詞庫與軍師錦囊
    this.learnedWords = this.loadLearnedWords();
    this.hintActive = false;
    this.currentHints = [];

    // 地理位置探知（科學園區精準推測）
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
    if (window.LEXICON_SCORED) {
      this.lexicon = window.LEXICON_SCORED;
      this.zhuyinMap = window.ZHUYIN_MAP || {};
      this.updateLexiconBadge("臺灣萌典詞庫已就緒 (14.7萬正體詞)", "萌典 14.7萬詞", "14.7萬詞", true);
      this.startNewBattle();
      return;
    }

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

  // ==========================================
  // DOM 事件綁定與控制面板
  // ==========================================
  initDOM() {
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

    const selGameMode = document.getElementById("select-game-mode");
    if (selGameMode) {
      selGameMode.addEventListener("change", (e) => {
        this.setGameMode(e.target.value);
      });
    }

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
        this.recenterViewport(boardViewport, false, false);
      });

      btnViewTable.addEventListener("click", () => {
        btnViewTable.classList.add("active");
        btnViewBoard.classList.remove("active");
        if (boardViewport) boardViewport.style.display = "none";
        if (tableViewport) tableViewport.style.display = "block";
      });
    }

    const btnToggleOptions = document.getElementById("btn-toggle-options");
    const controlDrawer = document.getElementById("control-options-drawer");
    if (btnToggleOptions && controlDrawer) {
      btnToggleOptions.addEventListener("click", () => {
        controlDrawer.classList.toggle("open");
        btnToggleOptions.classList.toggle("active");
      });
    }

    // 視窗即攝影鏡頭：啟用字陣畫布按住攀移與光學縮放
    const demoBoardViewport = document.getElementById("demo-board-viewport");
    this.setupViewportPan(boardViewport);
    if (demoBoardViewport) this.setupViewportPan(demoBoardViewport);

    // 縮放 HUD 按鈕綁定
    const btnZoomIn = document.getElementById("btn-zoom-in");
    const btnZoomOut = document.getElementById("btn-zoom-out");
    const btnZoomReset = document.getElementById("btn-zoom-reset");
    const zoomValBattle = document.getElementById("zoom-val-battle");
    if (btnZoomIn) btnZoomIn.addEventListener("click", () => this.zoomViewport(boardViewport, 0.15));
    if (btnZoomOut) btnZoomOut.addEventListener("click", () => this.zoomViewport(boardViewport, -0.15));
    if (btnZoomReset) btnZoomReset.addEventListener("click", () => this.recenterViewport(boardViewport, false, true));
    if (zoomValBattle) zoomValBattle.addEventListener("click", () => this.recenterViewport(boardViewport, false, true));

    // 右上角智慧卡拖曳與收合
    const wisdomDock = document.getElementById("wisdom-zoom-dock");
    const btnToggleWisdom = document.getElementById("btn-toggle-wisdom-dock");
    const isSmallTerminal = (typeof window !== "undefined" && (window.innerWidth <= 768 || window.innerHeight <= 600));
    if (wisdomDock && isSmallTerminal) {
      wisdomDock.classList.add("minimized");
      if (btnToggleWisdom) btnToggleWisdom.innerText = "▾";
    }
    if (btnToggleWisdom && wisdomDock) {
      btnToggleWisdom.addEventListener("click", (e) => {
        e.stopPropagation();
        wisdomDock.classList.toggle("minimized");
        btnToggleWisdom.innerText = wisdomDock.classList.contains("minimized") ? "▾" : "▴";
      });
    }
    if (wisdomDock) {
      this.makeDraggable(wisdomDock, "wordchain_wisdom_dock_pos", ".wisdom-drag-handle");
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

    // 全螢幕屏保觀戰控制
    const btnDemoFullscreen = document.getElementById("btn-demo-fullscreen");
    const btnZenExit = document.getElementById("btn-zen-exit");

    const enterZenFullscreen = () => {
      // 確保切換至棋盤對戰/演示主舞台，徹底隔離詞海手冊
      document.querySelectorAll(".tab-pane").forEach(p => {
        if (p.id === "tab-battle") {
          p.classList.add("active");
          p.style.display = "block";
        } else {
          p.classList.remove("active");
          p.style.display = "none";
        }
      });

      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {
          // 行動端或不支援原生全螢幕時，使用 CSS 類比滿版禪境模式
          document.body.classList.add("fullscreen-zen");
          if (window.WordChain && window.WordChain.ZenAmbient) window.WordChain.ZenAmbient.start();
        });
        if (!this.isDemoRunning) {
          this.startDemo();
        }
        resetZenIdleTimer();
        if (window.WordChain && window.WordChain.ZenAmbient) window.WordChain.ZenAmbient.start();
        showToast("🖥️ 已進入全螢幕觀戰模式（雙雄字戀屏保中）", "info", 2500);
      } else {
        document.exitFullscreen().catch(() => {
          document.body.classList.remove("fullscreen-zen");
          clearZenIdleTimers();
          if (window.WordChain && window.WordChain.ZenAmbient) window.WordChain.ZenAmbient.stop();
        });
      }
    };

    // 全螢幕觀戰滑鼠閒置自動淡出與游標隱形計時器 (Idle Cursor Fade-out & Auto-hide)
    let zenIdleTimer = null;
    let zenFadeTimer = null;

    const clearZenIdleTimers = () => {
      if (zenFadeTimer) { clearTimeout(zenFadeTimer); zenFadeTimer = null; }
      if (zenIdleTimer) { clearTimeout(zenIdleTimer); zenIdleTimer = null; }
      document.body.classList.remove("zen-cursor-hidden", "zen-cursor-fading");
    };

    const resetZenIdleTimer = () => {
      if (!document.body.classList.contains("fullscreen-zen")) return;

      if (zenFadeTimer) { clearTimeout(zenFadeTimer); zenFadeTimer = null; }
      if (zenIdleTimer) { clearTimeout(zenIdleTimer); zenIdleTimer = null; }

      document.body.classList.remove("zen-cursor-hidden", "zen-cursor-fading");

      // 2.0 秒閒置：按鈕平滑淡出
      zenFadeTimer = setTimeout(() => {
        if (document.body.classList.contains("fullscreen-zen")) {
          document.body.classList.add("zen-cursor-fading");
        }
      }, 2000);

      // 2.6 秒閒置：滑鼠游標完全隱形
      zenIdleTimer = setTimeout(() => {
        if (document.body.classList.contains("fullscreen-zen")) {
          document.body.classList.add("zen-cursor-hidden");
        }
      }, 2600);
    };

    window.addEventListener("mousemove", resetZenIdleTimer, { passive: true });
    window.addEventListener("mousedown", resetZenIdleTimer, { passive: true });
    window.addEventListener("wheel", resetZenIdleTimer, { passive: true });
    window.addEventListener("touchstart", resetZenIdleTimer, { passive: true });

    if (btnDemoFullscreen) {
      btnDemoFullscreen.addEventListener("click", () => enterZenFullscreen());
    }

    if (btnZenExit) {
      btnZenExit.addEventListener("click", () => {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          document.body.classList.remove("fullscreen-zen");
          clearZenIdleTimers();
          if (window.WordChain && window.WordChain.ZenAmbient) window.WordChain.ZenAmbient.stop();
          setTimeout(() => {
            const vp = document.getElementById("cross-board-viewport");
            if (vp) this.recenterViewport(vp, this.gameMode === "demo", false);
          }, 120);
        }
      });
    }

    document.addEventListener("fullscreenchange", () => {
      const isFS = !!document.fullscreenElement;
      document.body.classList.toggle("fullscreen-zen", isFS);
      if (isFS) {
        resetZenIdleTimer();
        if (window.WordChain && window.WordChain.ZenAmbient) window.WordChain.ZenAmbient.start();
      } else {
        clearZenIdleTimers();
        if (window.WordChain && window.WordChain.ZenAmbient) window.WordChain.ZenAmbient.stop();
      }
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
        const vp = document.getElementById("cross-board-viewport");
        if (vp) this.recenterViewport(vp, this.gameMode === "demo", false);
      }, 150);
    });

    // 結算彈窗按鈕
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
      btnVicShare.addEventListener("click", () => this.handleVictoryShare());
    }

    const btnVicPdf = document.getElementById("btn-vic-pdf");
    if (btnVicPdf) {
      btnVicPdf.addEventListener("click", () => this.downloadVictoryPDF());
    }

    const btnVicClose = document.getElementById("btn-vic-close");
    if (btnVicClose) {
      btnVicClose.addEventListener("click", () => {
        const modal = document.getElementById("modal-victory");
        if (modal) modal.style.display = "none";
      });
    }

    // 橫轉直 / 直轉橫與視窗縮放自動置中
    window.addEventListener("resize", () => {
      if (window.WordChain && window.WordChain.ZenAmbient) window.WordChain.ZenAmbient.resize();
      setTimeout(() => {
        const vp = document.getElementById("cross-board-viewport");
        if (vp) this.recenterViewport(vp, this.gameMode === "demo", false);
      }, 150);
    });

    window.addEventListener("orientationchange", () => {
      setTimeout(() => {
        const vp = document.getElementById("cross-board-viewport");
        if (vp) this.recenterViewport(vp, this.gameMode === "demo", false);
      }, 200);
    });
  }

  initSplash() {
    const splash = document.getElementById("splash-screen");
    if (!splash) return;

    const SPLASH_QUOTES = [
      { tag: "🍶 太白醉墨", text: "「仰天大笑出門去，我輩豈是蓬蒿人！今日且隨太白，一同字戀三千場！」" },
      { tag: "🌊 東坡豪邁", text: "「大江東去，浪淘盡，千古風流人物！閣下今日可曾字戀至興酣之處？」" },
      { tag: "🧐 文達雅趣", text: "「四庫全書腹中藏，借音取義字字香。文思泉湧，詞海弄潮，您今天字戀了沒？」" },
      { tag: "⚖️ 鐵面包公", text: "「鐵面無私，文心自照！公堂字海對弈，且看閣下今日如何字戀破局！」" },
      { tag: "✨ 字裡乾坤", text: "「同音合璧，雙字成雙；落子天元，字戀無雙。敢問閣下——您今天字戀了沒？」" }
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

  setGameMode(mode) {
    this.gameMode = mode;
    const sel = document.getElementById("select-game-mode");
    if (sel && sel.value !== mode) sel.value = mode;

    document.querySelectorAll(".tab-btn").forEach(b => {
      const target = b.getAttribute("data-target");
      if ((mode === "battle" && target === "tab-battle") || (mode === "demo" && target === "tab-demo")) {
        b.classList.add("active");
      } else {
        b.classList.remove("active");
      }
    });

    document.querySelectorAll(".tab-pane").forEach(p => {
      if (p.id === "tab-battle") {
        p.classList.add("active");
        p.style.display = "block";
      } else {
        p.classList.remove("active");
        p.style.display = "none";
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
      if (!this.isDemoRunning) this.startDemo();
    } else {
      if (humanDock) humanDock.style.display = "flex";
      if (demoDock) demoDock.style.display = "none";
      if (personaGroup) personaGroup.style.display = "flex";
      if (this.isDemoRunning) {
        if (this.demoTimer) clearInterval(this.demoTimer);
        this.demoTimer = null;
        this.isDemoRunning = false;
        const btn = document.getElementById("btn-start-demo");
        if (btn) btn.innerText = "開始演示";
      }
      const inputEl = document.getElementById("input-word");
      if (inputEl) setTimeout(() => inputEl.focus(), 100);
    }
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
      if (playerBadge) playerBadge.innerText = "觀戰中";
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

  // ==========================================
  // 計時系統 (Timer)
  // ==========================================
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
        const fullText = (this.timeLimit > 0) ? `⏱️ ${this.timeLimit}s (等候首招)` : `⏱️ (等候首招)`;
        const compactText = (this.timeLimit > 0) ? `⏱️ ${this.timeLimit}s` : `⏱️ 等候`;
        lbl.innerHTML = `<span class="hud-label-full">${fullText}</span><span class="hud-label-compact">${compactText}</span>`;
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
      this.endBattle("player_hp_zero");
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
  // HUD 狀態與儀表卡
  // ==========================================
  updateHUD() {
    const pScoreEl = document.getElementById("lbl-player-score");
    const aiScoreEl = document.getElementById("lbl-ai-score");
    const pBar = document.getElementById("bar-player-hp");
    const aiBar = document.getElementById("bar-ai-hp");
    const persona = PERSONAS[this.currentPersona] || PERSONAS.ji_xiaolan;
    const maxHp = this.maxHp || 1000;

    if (pScoreEl) {
      pScoreEl.innerHTML = `
        <span class="hud-label-full">👤 閣下: ${this.playerHp} / ${maxHp} HP | 積分: ${this.playerScore}</span>
        <span class="hud-label-compact">👤 ${this.playerHp} (${this.playerScore}分)</span>
      `;
    }
    if (aiScoreEl) {
      aiScoreEl.innerHTML = `
        <span class="hud-label-full">${persona.icon} ${persona.name}: ${this.aiHp} / ${maxHp} HP | 積分: ${this.aiScore}</span>
        <span class="hud-label-compact">${persona.icon} ${this.aiHp} (${this.aiScore}分)</span>
      `;
    }
    if (pBar) pBar.style.width = `${Math.max(0, Math.min(100, (this.playerHp / maxHp) * 100)).toFixed(1)}%`;
    if (aiBar) aiBar.style.width = `${Math.max(0, Math.min(100, (this.aiHp / maxHp) * 100)).toFixed(1)}%`;
  }

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

  appendFlowTableRow(round, speaker, word, modeTag, elapsed, points) {
    const tbody = document.getElementById("flow-table-body");
    if (!tbody) return;

    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";

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

    tr.onclick = () => {
      this.updateStoryCard(word);
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
  // 對弈核心邏輯 (Start, Turn, AI, Surrender, End)
  // ==========================================
  startNewBattle() {
    const starters = ["天馬行空", "開門見山", "海闊天空", "龍飛鳳舞", "萬象更新", "心曠神怡", "乘風破浪", "浩然正氣"];
    this.battleCurrentWord = starters[Math.floor(Math.random() * starters.length)];
    this.battleUsedWords = new Set([this.battleCurrentWord]);
    this.roundCount = 1;

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

    // 自學詞庫登記
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

    const punInfo = checkTruePun(word, this.lexicon);
    const isTruePun = !!punInfo;
    const isExact = check.isExact;
    const playerTail = getTailChar(word);
    const tailData = this.lexicon && this.lexicon[playerTail];
    const tailScore = (tailData && tailData.w) ? tailData.w.length : 0;

    // 調用 AI 模組統一計分與傷害演算法
    const comboState = {
      exactCount: this.playerExactCount,
      exactCombo: this.playerExactCombo,
      phoneticCount: this.playerPhoneticCount,
      phoneticCombo: this.playerPhoneticCombo,
      truePunCount: this.playerTruePunCount,
      exactPunCount: this.playerExactPunCount,
      homophoneCount: this.playerHomophoneCount,
      homophoneCombo: this.playerHomophoneCombo
    };

    const calcResult = WordChain.AI.calculatePlayerPoints({
      word,
      isExact,
      isTruePun,
      punInfo,
      elapsed,
      tailScore,
      comboState
    });

    this.playerExactCount = comboState.exactCount;
    this.playerExactCombo = comboState.exactCombo;
    this.playerPhoneticCount = comboState.phoneticCount;
    this.playerPhoneticCombo = comboState.phoneticCombo;
    this.playerTruePunCount = comboState.truePunCount;
    this.playerExactPunCount = comboState.exactPunCount;
    this.playerHomophoneCount = comboState.homophoneCount;
    this.playerHomophoneCombo = comboState.homophoneCombo;

    if (isTruePun) {
      this.playerPunWords.push({ word, original: punInfo.original, type: isExact ? "exact-pun" : "homo-pun" });
    }

    const pts = calcResult.pts;
    const dmg = calcResult.dmg;
    const bonusPts = calcResult.bonusPts;
    const lenDesc = calcResult.lenDesc;

    if (calcResult.category === "exact_pun") {
      showToast(`👑🤣 原字諧音雙關！既正統直咬又生諧音新趣！化用【${punInfo.original}】特賞 +${bonusPts} 分！`, "success", 4000);
    } else if (calcResult.category === "homo_pun") {
      showToast(`🤣 同音諧音雙關！化用【${punInfo.original}】深入骨髓諧音魂大爆發！特賞 +${bonusPts} 分！`, "success", 3500);
    } else if (calcResult.category === "exact" && this.playerExactCombo > 1) {
      showToast(`👑 原字直咬！正統連擊 x${this.playerExactCombo}！獎勵 +${bonusPts} 分！`, "success", 2500);
    } else if (calcResult.category === "homo") {
      showToast(`🎵 借音通押！聲律相和 (借音連擊 x${this.playerPhoneticCombo})！獎勵 +${bonusPts} 分！`, "success", 2500);
    }

    this.aiHp = Math.max(0, this.aiHp - dmg);
    this.playerScore += pts;
    this.updateHUD();

    this.battleUsedWords.add(word);
    this.battleCurrentWord = word;
    this.roundCount++;

    let matchDesc = check.desc;
    if (isExact && isTruePun) matchDesc = `👑🤣 原字諧音 (化用：${punInfo.original})`;
    else if (!isExact && isTruePun) matchDesc = `🤣 同音諧音 (化用：${punInfo.original})`;
    else if (isExact) matchDesc = (this.playerExactCombo > 1) ? `👑 原字連擊 x${this.playerExactCombo}` : `👑 原字直咬`;
    else matchDesc = (this.playerPhoneticCombo > 1) ? `🎵 借音連擊 x${this.playerPhoneticCombo} (${check.matchingZhuyin || check.desc})` : `🎵 借音通押 (${check.matchingZhuyin || check.desc})`;

    const speedTag = elapsed < 3.0 ? "極速" : elapsed <= 8.0 ? "敏捷" : "沉穩";
    const radarTag = tailScore === 0 ? "💀絕殺" : tailScore <= 3 ? "⚠️險局" : tailScore <= 20 ? "⚔️激戰" : "🟢汪洋";

    let playerBanter = "";
    if (isExact && isTruePun) playerBanter = `原字諧音雙修！既正統直咬又生諧音新意【${word}】破局 (化用【${punInfo.original}】，+${bonusPts}分)！`;
    else if (!isExact && isTruePun) playerBanter = `深入骨髓諧音魂！以同音諧音雙關【${word}】破局 (化用【${punInfo.original}】，+${bonusPts}分)！`;
    else if (isExact && this.playerExactCombo > 1) playerBanter = `原字直咬！連擊 x${this.playerExactCombo} 打出【${word}】(+${bonusPts}分)！`;
    else if (isExact) playerBanter = `堂堂正正，原字直咬出招【${word}】！(耗時 ${elapsed.toFixed(1)}s)`;
    else playerBanter = `聲律相通！借音打出【${word}】(借音連擊 x${this.playerPhoneticCombo}，+${bonusPts}分)！`;

    this.placeWordOnBoard(word, "player", playerBanter, true);
    this.appendFlowTableRow(this.roundCount, "👤 閣下", word, matchDesc, elapsed, pts);
    this.updateScorerCard(this.roundCount, "👤 閣下", word, matchDesc, `${elapsed.toFixed(1)}s (${speedTag})`, lenDesc, radarTag, `生路 ${tailScore} 步`, pts, dmg);
    this.updateTargetCard(word);
    this.updateStoryCard(word);

    const persona = PERSONAS[this.currentPersona] || PERSONAS.ji_xiaolan;
    this.updateLiveBanter("👤", `閣下打出【${word}】(+${pts}分 · ${matchDesc}) —— ${persona.name} 請接招！`);

    input.value = "";

    if (this.aiHp <= 0) {
      this.endBattle("ai_hp_zero");
      return;
    }

    this.updateRomanceStatus("ai");
    setTimeout(() => this.aiTurn(), 750);
  }

  aiTurn() {
    const tailChar = getTailChar(this.battleCurrentWord);
    const entries = this.getScoredEntries(tailChar, this.allowHomophone, false, this.battleCurrentWord);
    const persona = PERSONAS[this.currentPersona] || PERSONAS.ji_xiaolan;

    if (!entries || entries.length === 0) {
      this.endBattle("ai_resigned");
      return;
    }

    const aiDecision = WordChain.AI.selectAIMove(entries, this.difficulty, this.learnedWords);
    if (!aiDecision || !aiDecision.entry) {
      this.endBattle("ai_resigned");
      return;
    }

    const chosenEntry = aiDecision.entry;
    const strategy = aiDecision.strategy;
    const chosenWord = chosenEntry[0];
    const aiHead = getHeadChar(chosenWord);
    const lastTail = getTailChar(this.battleCurrentWord);
    const isExact = (aiHead === lastTail);
    const aiTailScore = chosenEntry[2] || 0;

    const { aiPts, aiDmg } = WordChain.AI.calculateAIPoints(chosenWord, isExact, aiTailScore);
    this.playerHp = Math.max(0, this.playerHp - aiDmg);
    this.aiScore += aiPts;
    this.updateHUD();

    const lastWord = this.battleCurrentWord;
    this.battleUsedWords.add(chosenWord);
    this.battleCurrentWord = chosenWord;
    this.roundCount++;

    const matchDesc = isExact ? "👑同字直咬" : "🎵同音接龍";
    const radarTag = aiTailScore === 0 ? "💀絕殺" : aiTailScore <= 3 ? "⚠️險局" : aiTailScore <= 20 ? "⚔️激戰" : "🟢汪洋";
    const banter = generateSituationalBanter(this.currentPersona, chosenWord, lastWord, strategy);

    this.placeWordOnBoard(chosenWord, "ai", banter, false);
    this.appendFlowTableRow(this.roundCount, `${persona.icon} ${persona.name}`, chosenWord, matchDesc, 1.2, aiPts);
    this.updateScorerCard(this.roundCount, persona.name, chosenWord, matchDesc, "1.2s (敏捷)", `${chosenWord.length}字`, radarTag, strategy, aiPts, aiDmg);
    this.updateTargetCard(chosenWord);
    this.updateStoryCard(chosenWord);
    this.updateLiveBanter(persona.icon, `${persona.name}打出【${chosenWord}】(+${aiPts}分 · ${matchDesc}) ——「${banter}」`);

    if (this.playerHp <= 0) {
      this.endBattle("player_hp_zero");
      return;
    }

    this.updateRomanceStatus("player");
    this.startTimer();
  }

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
      this.roundCount, "💡 軍師獻策", h1[0], "戰術錦囊 (按 1~4 快捷出招)", "極速", `${h1[0].length}字`, h1[4], `留存 ${h1[2]} 步生路`, 0, 0
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
    this.playerScore = Math.max(0, this.playerScore - 50);
    this.endBattle("surrender");
  }

  endBattle(reason = "ai_hp_zero") {
    this.stopTimer();
    this.clearHintBar();

    const persona = PERSONAS[this.currentPersona] || PERSONAS.ji_xiaolan;
    const pBonus = Math.max(0, this.playerHp * 2);
    const aiBonus = Math.max(0, this.aiHp * 2);
    this.playerScore += pBonus;
    this.aiScore += aiBonus;
    this.updateHUD();

    const isPlayerWinner = (this.playerScore >= this.aiScore);

    if (isPlayerWinner) {
      if (reason === "player_hp_zero") {
        this.updateLiveBanter("🏆", `文壇大捷！閣下雖力竭鳴金，然文采驚絕天下（${this.playerScore}分 🆚 ${this.aiScore}分），技壓 ${persona.name}，榮膺勝者！`);
        showToast(`🎉 終局結算！閣下總分 ${this.playerScore} 技壓 ${persona.name}（${this.aiScore}分），文壇大捷！`, "success", 5000);
      } else if (reason === "ai_hp_zero") {
        this.updateLiveBanter("🏆", `戰局分曉！${persona.name} 氣血耗盡，閣下威震詞海（${this.playerScore}分 🆚 ${this.aiScore}分），大獲全勝！`);
        showToast(`🎉 恭喜！對手氣血耗盡，閣下以 ${this.playerScore} 分大獲全勝！`, "success", 5000);
      } else if (reason === "ai_resigned") {
        this.updateLiveBanter("🏆", `才高八斗！${persona.name} 辭窮認輸，閣下總分 ${this.playerScore} 傲視群雄！`);
        showToast(`🎉 恭喜！AI 辭窮認輸，閣下獲勝！`, "success", 5000);
      } else {
        this.updateLiveBanter("🏆", `文壇大捷！閣下總分 ${this.playerScore} 技壓 ${persona.name}（${this.aiScore}分）！`);
        showToast("🎉 終局結算，閣下勝出！", "success", 5000);
      }
    } else {
      if (reason === "player_hp_zero") {
        this.updateLiveBanter("💀", `戰局分曉！閣下氣血耗盡，${persona.name} 總分 ${this.aiScore} 略勝一籌（閣下 ${this.playerScore} 分）！`);
        showToast(`💀 戰局告終！${persona.name} 以 ${this.aiScore} 分險勝，閣下雖敗猶榮！`, "warning", 5000);
      } else if (reason === "surrender") {
        this.updateLiveBanter("🏳️", `閣下認輸：山高水長，來日方長！${persona.name} 總分 ${this.aiScore} 勝出！`);
        showToast(`閣下認輸，${persona.name} 抱拳回禮！`, "warning", 5000);
      } else {
        this.updateLiveBanter("⚖️", `終局鳴金！${persona.name} 總分 ${this.aiScore} 險勝一籌！`);
        showToast(`戰局告終，${persona.name} 略勝一籌！`, "info", 5000);
      }
    }

    this.showVictoryModal(reason, isPlayerWinner);
  }

  showVictoryModal(reason = "氣血耗盡", isPlayerWinner = true) {
    const modal = document.getElementById("modal-victory");
    if (!modal) return;

    const persona = PERSONAS[this.currentPersona] || PERSONAS.ji_xiaolan;
    const rounds = this.roundCount;

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

    const sealEl = document.getElementById("vic-seal-stamp");
    const crownEl = document.getElementById("vic-crown");
    const titleEl = document.getElementById("vic-title");
    const subEl = document.getElementById("victory-subtitle");
    const vsEl = document.getElementById("vic-score-vs");

    if (sealEl) sealEl.innerText = isPlayerWinner ? "字戀狂認證" : "文壇風雅印";
    if (crownEl) crownEl.innerText = isPlayerWinner ? "👑" : "🎖️";

    let victoryTitleText = "您這個完美字戀狂！";
    let victorySubtitleText = "";

    if (isPlayerWinner) {
      if (reason === "player_hp_zero") {
        victoryTitleText = "文采冠絕 · 逆轉乾坤！";
        victorySubtitleText = `閣下雖力竭鳴金，然文采驚天地泣鬼神，總分 ${this.playerScore} 技壓 ${persona.name}（${this.aiScore}分），大獲全勝！`;
      } else if (reason === "ai_resigned") {
        victoryTitleText = "詞窮絕殺 · 孤篇橫絕！";
        victorySubtitleText = `才高八斗，封死生路；${persona.name} 辭窮認輸，甘拜下風！（閣下 ${this.playerScore} 分 🆚 對手 ${this.aiScore} 分）`;
      } else {
        victoryTitleText = "您這個完美字戀狂！";
        victorySubtitleText = `滿腹經綸，威震文壇；${persona.name} 氣血耗盡，甘拜下風！（閣下 ${this.playerScore} 分 🆚 對手 ${this.aiScore} 分）`;
      }
    } else {
      victoryTitleText = "風雅交鋒 · 惜敗名士";
      victorySubtitleText = `雙方激戰文壇，${persona.name} 總分 ${this.aiScore} 略勝一籌（閣下 ${this.playerScore} 分），閣下雖敗猶榮！`;
    }

    if (titleEl) titleEl.innerText = victoryTitleText;
    if (subEl) subEl.innerText = victorySubtitleText;

    if (vsEl) {
      const outcomeTag = isPlayerWinner ? "🏆 閣下勝出" : "⚖️ 名士勝出";
      vsEl.innerHTML = `👤 閣下 <b>${this.playerScore}</b> 分 🆚 ${persona.icon} ${persona.name} <b>${this.aiScore}</b> 分 (${outcomeTag})`;
    }

    const rEl = document.getElementById("vic-rounds");
    if (rEl) rEl.innerText = rounds;

    const lEl = document.getElementById("vic-longest");
    if (lEl) {
      lEl.title = longestWord;
      lEl.innerHTML = `<span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:95px; display:inline-block; vertical-align:bottom;">${bestWord}</span><span style="font-size:0.75em; opacity:0.85; margin-left:3px; white-space:nowrap;">(${maxLen}字)</span>`;
    }

    const sEl = document.getElementById("vic-speed");
    if (sEl) sEl.innerText = speedStr;

    const scEl = document.getElementById("vic-score");
    if (scEl) scEl.innerText = this.playerScore;

    const pEl = document.getElementById("vic-rank-pill");
    if (pEl) pEl.innerText = `🏅 榮譽頭銜：${rankTitle}`;

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
      badgeText = (punCount >= 3)
        ? `🇹🇼 臺灣諧音梗宗師 · 深入骨髓諧音魂！(諧音雙關 ${punCount} 次 · 妙趣橫生！)`
        : `🤣 臺灣諧音梗達人 · 雙關妙語連珠！(諧音雙關 ${punCount} 次)`;
    } else if (phoneticCount > 0) {
      badgeType = "rhyme";
      badgeText = (phoneticCount >= 5 || (phoneticCount >= 2 && phoneticCount / totalPlayerMoves >= 0.4))
        ? `🎵 聲律宗師 · 借音無礙！(借音出招 ${phoneticCount} 次 · 佔比 ${phoneticRate}%)`
        : `🎶 聲韻大家 · 翻宮轉調！(借音出招 ${phoneticCount} 次)`;
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
    this.lastIsPlayerWinner = isPlayerWinner;
    this.lastVictoryTitle = victoryTitleText;
    this.lastVictorySubtitle = victorySubtitleText;

    modal.style.display = "flex";
    this.updateRomanceStatus(isPlayerWinner ? "victory" : "defeat");
  }

  async handleVictoryShare() {
    const rank = document.getElementById("vic-rank-pill")?.innerText || "完美字戀狂";
    const career = this.lastCareer || this.divineCareer();
    let specialStr = "";
    if (this.lastHomoBadge) {
      specialStr = (this.lastBadgeType === "pun")
        ? `🤣 諧音特賞：${this.lastHomoBadge}\n`
        : `🎵 聲韻特賞：${this.lastHomoBadge}\n`;
    }
    const isWin = (this.lastIsPlayerWinner !== false);
    const persona = PERSONAS[this.currentPersona] || PERSONAS.ji_xiaolan;
    const text = `📜【字戀 (WordChain) 文壇論道捷報】\n` +
      (isWin
        ? `我以「${rank.replace('🏅 榮譽頭銜：', '').trim()}」之姿橫掃文壇，讓大文豪甘拜下風！\n`
        : `我與大文豪「${persona.name}」在文壇縱橫論道，雖敗猶榮！\n`) +
      specialStr +
      `• 終局戰分：閣下 ${this.playerScore} 分 🆚 ${persona.name} ${this.aiScore} 分 (${isWin ? '🏆 完勝' : '⚖️ 惜敗'})\n` +
      `• 對弈回合：${this.roundCount} 輪\n` +
      `• 終局題目：【${this.battleCurrentWord}】\n` +
      `🔮 職業神算：${career.title}\n` +
      `   （評：${career.desc}）\n` +
      `敢問閣下——您今天字戀了沒？\n` +
      `👉 立即入陣：https://yuktesha.github.io/wordchain/`;

    try {
      const canvas = this.generateVictoryCardCanvas(3.0);
      canvas.toBlob(async (blob) => {
        if (blob && navigator.clipboard && window.ClipboardItem) {
          try {
            const item = new ClipboardItem({
              "image/png": blob,
              "text/plain": new Blob([text], { type: "text/plain" })
            });
            await navigator.clipboard.write([item]);
            showToast("🎉 4K 超高解析戰報圖卡與文案已複製到剪貼簿！可直接貼於社群分享！", "success", 4000);
            return;
          } catch (clipErr) {
            console.warn("ClipboardItem write fallback:", clipErr);
          }
        }
        await navigator.clipboard.writeText(text);
        const a = document.createElement("a");
        a.download = `字戀狂勝戰捷報-4K超高解析-${Date.now()}.png`;
        a.href = canvas.toDataURL("image/png");
        a.click();
        showToast("📋 戰報文字已複製，4K 超高解析圖卡已自動下載儲存！", "success", 4000);
      });
    } catch (e) {
      await navigator.clipboard.writeText(text);
      showToast("📋 戰報文案已複製到剪貼簿！", "success");
    }
  }

  // ==========================================
  // 雙雄相聲演示模式 (Demo Engine)
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

    this.boardMap.clear();
    const grid = document.getElementById("cross-board-grid");
    if (grid) grid.innerHTML = "";
    const flowTbody = document.getElementById("flow-table-body");
    if (flowTbody) flowTbody.innerHTML = "";

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

    const starters = ["天馬行空", "開門見山", "海闊天空", "乘風破浪", "萬古流芳", "浩然正氣"];
    this.demoCurrentWord = starters[Math.floor(Math.random() * starters.length)];
    this.battleCurrentWord = this.demoCurrentWord;
    this.demoUsedWords = new Set([this.demoCurrentWord]);
    this.battleUsedWords = new Set([this.demoCurrentWord]);

    this.placeWordOnBoard(this.demoCurrentWord, "system", "🚩 系統立題 · 雙雄演示開鑼！", false, true, false);
    this.appendFlowTableRow(1, "🚩 系統立題", this.demoCurrentWord, "初始陣勢", 0.0, 0);
    this.appendDemoFlowTableRow(1, "🚩 系統立題", this.demoCurrentWord, "初始陣勢", 0.0);
    this.updateTargetCard(this.demoCurrentWord);
    this.updateStoryCard(this.demoCurrentWord);
    this.updateDemoStageCards(this.demoCurrentWord, "系統開局", "🚩 系統出題 · 初始陣勢", "天馬行空開局，雙雄對決即將開鑼！");
    this.updateLiveBanter("🚩", `系統立題【${this.demoCurrentWord}】，雙雄對決正式開擂！`);
    this.updateLiveBanter("🚩", `系統立題【${this.demoCurrentWord}】，雙雄對決正式開擂！`, true);

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

    const pickPoolSize = Math.min(entries.length, 5);
    const chosen = entries[Math.floor(Math.random() * pickPoolSize)];
    const nextWord = chosen[0];
    const headC = getHeadChar(nextWord);

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

    this.placeWordOnBoard(nextWord, speakerType, `${persona.name}：${banter}`, false, false, false);
    this.appendFlowTableRow(this.demoRound, `${persona.icon} ${persona.name}`, nextWord, matchDesc, 1.2, 0);
    this.appendDemoFlowTableRow(this.demoRound, `${persona.icon} ${persona.name}`, nextWord, matchDesc, 1.2);

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
      if (btn) btn.innerText = "開始演示";
    }

    this.setGameMode("battle");
    this.battleCurrentWord = this.demoCurrentWord;
    this.battleUsedWords = new Set(this.demoUsedWords);
    this.roundCount = this.demoRound;

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
  // 模組委派介面 (Delegated Module Methods)
  // ==========================================
  placeWordOnBoard(word, speakerType, banterText, isPlayer = false, isInitial = false, isDemo = false) {
    WordChain.Board.placeWordOnBoard(this, word, speakerType, banterText, isPlayer, isInitial, isDemo);
  }

  renderHomoCell(cell, cellData) {
    WordChain.Board.renderHomoCell(cell, cellData, this.homoStyle);
  }

  refreshHomoCells() {
    for (const [key, data] of this.boardMap.entries()) {
      if (data.isPivot && data.isHomo && data.prevChar && data.prevChar !== data.char) {
        const [r, c] = key.split(",");
        const cell = document.getElementById(`cell-${r}-${c}`);
        if (cell) this.renderHomoCell(cell, data);
      }
    }
    for (const [key, data] of this.demoBoardMap.entries()) {
      if (data.isPivot && data.isHomo && data.prevChar && data.prevChar !== data.char) {
        const [r, c] = key.split(",");
        const cell = document.getElementById(`demo-cell-${r}-${c}`);
        if (cell) this.renderHomoCell(cell, data);
      }
    }
  }

  setupViewportPan(viewport) {
    WordChain.Viewport.setupViewportPan(viewport, this);
  }

  zoomViewport(viewport, delta) {
    WordChain.Viewport.zoomViewport(viewport, delta);
  }

  recenterViewport(viewport, isDemo = false, resetScale = true) {
    WordChain.Viewport.recenterViewport(viewport, this, isDemo, resetScale);
  }

  makeDraggable(el, storageKey, handleSelector = null) {
    WordChain.Viewport.makeDraggable(el, storageKey, handleSelector);
  }

  divineCareer(words = []) {
    return WordChain.Career.divineCareer(words, this.userTechPark);
  }

  detectUserTechPark() {
    WordChain.Career.detectUserTechPark(park => { this.userTechPark = park; });
  }

  getScoredEntries(tailChar, allowHomo = true, isDemo = false, currentWord = "") {
    const usedWords = isDemo ? this.demoUsedWords : this.battleUsedWords;
    return WordChain.AI.getScoredEntries(this.lexicon, tailChar, {
      allowHomo,
      strictTone: this.strictTone,
      usedWords,
      currentWord
    });
  }

  generateVictoryCardCanvas(scale = 3.0) {
    return WordChain.Victory.generateVictoryCardCanvas(this, scale);
  }

  generateVictoryCardSVG() {
    return WordChain.Victory.generateVictoryCardSVG(this);
  }

  downloadVictoryPDF() {
    WordChain.Victory.downloadVictoryPDF(this);
  }

  getWordAuditStatus(w) {
    return WordChain.Learned.getWordAuditStatus(this, w);
  }

  renderLearnedTable() {
    WordChain.Learned.renderLearnedTable(this);
  }

  openGemmaAuditModal() {
    WordChain.Learned.openGemmaAuditModal(this);
  }

  confirmGemmaAdopt() {
    WordChain.Learned.confirmGemmaAdopt(this);
  }

  clearVerifiedLearnedWords() {
    WordChain.Learned.clearVerifiedLearnedWords(this);
  }

  exportLearnedWords() {
    WordChain.Learned.exportLearnedWords(this);
  }
}

if (typeof window !== "undefined") {
  window.WordChainWeb = WordChainWeb;
}

// 頁面就緒時啟動
window.addEventListener("DOMContentLoaded", () => {
  window.game = new WordChainWeb();
  window.wordChainApp = window.game;
  window.game.renderLearnedTable();
});
