/**
 * texTile (詞布達意) - GitHub Pages 純前端靜態版
 * 驅動核心：如喜輸入法 (RuhI) 語意消歧技術展示
 */

// 狀態機
const state = {
  challenges: [],
  currentIndex: 0,
  mode: 'single', // 'single' | 'checkpoint' | 'scroll'
  evalCache: {}, // 儲存各題評分結果
  currentTilesOrder: [], // 當前詞塊順序
  slotInputs: [], // 縫隙輸入內容 [slot0, slot1, slot2...]
  currentSentence: ""
};

// DOM 元素快取
const dom = {
  title: document.getElementById('chal-title'),
  phonetic: document.getElementById('chal-phonetic'),
  category: document.getElementById('chal-cat'),
  hint: document.getElementById('chal-hint'),
  currentNum: document.getElementById('chal-current-num'),
  totalNum: document.getElementById('chal-total-num'),
  btnPrev: document.getElementById('btn-prev'),
  btnNext: document.getElementById('btn-next'),
  weavingTrack: document.getElementById('weaving-track'),
  renderedText: document.getElementById('rendered-text'),
  btnEval: document.getElementById('btn-eval'),
  btnPrevInline: document.getElementById('btn-prev-inline'),
  btnReweave: document.getElementById('btn-reweave'),
  btnNextInline: document.getElementById('btn-next-inline'),
  btnReset: document.getElementById('btn-reset'),
  critiqueCard: document.getElementById('critique-card'),
  scoreNumber: document.getElementById('score-number'),
  verdictSeal: document.getElementById('verdict-seal'),
  critiqueBody: document.getElementById('critique-body'),
  critiqueQuote: document.getElementById('critique-quote'),
  commitStatus: document.getElementById('commit-status')
};

// 1. 初始化與載入題庫
async function init() {
  setupEventListeners();

  // 優先嘗試相對路徑讀取靜態 challenges.json
  try {
    const res = await fetch('./challenges.json');
    if (res.ok) {
      state.challenges = await res.json();
    }
  } catch (e) {
    console.warn("未能讀取 ./challenges.json，啟用保底題庫", e);
  }

  // 離線完整保底題庫（相容直接以 file:// 開啟或網路問題）
  if (!state.challenges || state.challenges.length === 0) {
    state.challenges = [
      {
        id: "duel_01",
        title: "先機與神仙",
        tiles: ["先這樣", "仙這樣"],
        phonetic: "ㄒㄧㄢ ㄓㄜˋ ㄧㄤˋ",
        category: "音韻雙關",
        difficulty: 2,
        hint: "一個是日常收尾告辭的口頭禪，一個是神仙灑脫超然的風姿。"
      },
      {
        id: "duel_02",
        title: "文膽與唇舌",
        tiles: ["比什麼", "筆舌墨"],
        phonetic: "ㄅㄧˇ ㄕㄣˊ ˙ㄇㄜ / ㄅㄧˇ ㄕㄜˊ ㄇㄛˋ",
        category: "文白對照",
        difficulty: 3,
        hint: "一個是俗語間的較勁攀比，一個是文人書齋裡馳騁的文房三寶。"
      },
      {
        id: "duel_03",
        title: "法度與力量",
        tiles: ["權力", "權利"],
        phonetic: "ㄑㄩㄢˊ ㄌㄧˋ",
        category: "法政語境",
        difficulty: 2,
        hint: "一個是支配統御的強制力量，一個是法律保障的正當利益。"
      },
      {
        id: "duel_12",
        title: "如喜傳奇：四重南難",
        tiles: ["男的", "南邊", "難得", "很難"],
        phonetic: "ㄋㄢˊ",
        category: "如喜試金石",
        difficulty: 5,
        hint: "如喜輸入法經典極端試金石：性別、方位、罕見與艱難的四重大對決。"
      },
      {
        id: "duel_13",
        title: "如喜之鑰：的分得定",
        tiles: ["經典的", "住得"],
        phonetic: "ㄉㄜ˙ / ㄉㄜˊ",
        category: "如喜語意場",
        difficulty: 4,
        hint: "跨語言分野：台語 ê（領屬定語）與 kah（程度補語）的精準辨析。"
      }
    ];
  }

  dom.totalNum.textContent = state.challenges.length;
  loadChallenge(0);
}

// 2. 載入特定題目 (首尾自然環狀相接)
function loadChallenge(index) {
  const total = state.challenges.length;
  if (total === 0) return;

  const cyclicIndex = (index % total + total) % total;
  state.currentIndex = cyclicIndex;
  const item = state.challenges[cyclicIndex];

  dom.currentNum.textContent = cyclicIndex + 1;
  dom.title.textContent = item.title;
  dom.phonetic.textContent = item.phonetic;
  dom.category.textContent = item.category;
  dom.hint.textContent = item.hint;

  dom.btnPrev.disabled = false;
  dom.btnNext.disabled = false;

  // 初始化詞塊與插槽
  state.currentTilesOrder = [...item.tiles];
  state.slotInputs = new Array(state.currentTilesOrder.length + 1).fill("");

  // 快取復原
  if (state.evalCache[item.id]) {
    const saved = state.evalCache[item.id];
    state.currentTilesOrder = [...saved.tilesOrder];
    state.slotInputs = [...saved.slotInputs];
    showCritique(saved.evalResult);
  } else {
    hideCritique();
  }

  renderStage();
  updateLivePreview();
}

// 3. 渲染舞台（動態插槽與詞塊磁磚）
function renderStage() {
  dom.weavingTrack.innerHTML = '';

  const numTiles = state.currentTilesOrder.length;
  for (let i = 0; i <= numTiles; i++) {
    // 渲染插槽 (Slot i)
    const slotWrap = document.createElement('div');
    slotWrap.className = 'weaving-slot';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'slot-input';
    input.dataset.slotIndex = i;
    input.value = state.slotInputs[i] || "";
    input.placeholder = i === 0 ? "起首織句..." : (i === numTiles ? "收尾拓印..." : "夾道銜接...");

    // 動態自適應寬度
    const adjustWidth = (el) => {
      const len = el.value.length;
      if (len === 0) {
        el.style.width = "110px";
      } else {
        el.style.width = Math.min(480, Math.max(110, len * 20 + 36)) + "px";
      }
    };
    adjustWidth(input);

    input.addEventListener('input', (e) => {
      state.slotInputs[i] = e.target.value;
      adjustWidth(e.target);
      updateLivePreview();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        dom.btnEval.click();
      }
    });

    slotWrap.appendChild(input);
    dom.weavingTrack.appendChild(slotWrap);

    // 渲染詞塊 (Tile i)
    if (i < numTiles) {
      const tileText = state.currentTilesOrder[i];
      const tileEl = document.createElement('div');
      tileEl.className = 'tile-item';
      tileEl.draggable = true;
      tileEl.dataset.tileIndex = i;
      tileEl.innerHTML = `
        <span class="tile-drag-handle">⠿</span>
        <span class="tile-text">${tileText}</span>
      `;

      setupDragAndDrop(tileEl, i);

      tileEl.title = "拖曳或雙擊可調換前後順序";
      tileEl.addEventListener('dblclick', () => {
        swapTiles(i, (i + 1) % numTiles);
      });

      dom.weavingTrack.appendChild(tileEl);
    }
  }
}

// 4. 詞塊拖放與順序切換
let draggedTileIdx = null;

function setupDragAndDrop(tileEl, index) {
  tileEl.addEventListener('dragstart', (e) => {
    draggedTileIdx = index;
    tileEl.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  tileEl.addEventListener('dragend', () => {
    tileEl.classList.remove('dragging');
    draggedTileIdx = null;
  });

  tileEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });

  tileEl.addEventListener('drop', (e) => {
    e.preventDefault();
    if (draggedTileIdx !== null && draggedTileIdx !== index) {
      swapTiles(draggedTileIdx, index);
    }
  });
}

function swapTiles(idx1, idx2) {
  const temp = state.currentTilesOrder[idx1];
  state.currentTilesOrder[idx1] = state.currentTilesOrder[idx2];
  state.currentTilesOrder[idx2] = temp;
  renderStage();
  updateLivePreview();
}

// 5. 即時宣紙拓印渲染預覽
function updateLivePreview() {
  let fullHtml = "";
  let plainText = "";

  const numTiles = state.currentTilesOrder.length;
  for (let i = 0; i <= numTiles; i++) {
    const textPart = state.slotInputs[i] || "";
    if (textPart) {
      fullHtml += `<span>${escapeHtml(textPart)}</span>`;
      plainText += textPart;
    }
    if (i < numTiles) {
      const tileWord = state.currentTilesOrder[i];
      fullHtml += `<mark class="tile-mark">【${escapeHtml(tileWord)}】</mark>`;
      plainText += tileWord;
    }
  }

  dom.renderedText.innerHTML = fullHtml || `<span style="color: #A09B90; font-style: italic;">請在上方織布插槽中填入文句，連結【${state.currentTilesOrder.join('】與【')}】...</span>`;
  state.currentSentence = plainText;
}

// 6. 前端文心評分引擎 (Client-side Heuristic Engine)
function evaluateLocally(sentence, tiles, chalTitle) {
  const clean = sentence.trim();
  const hasAll = tiles.every(t => clean.includes(t));
  const len = clean.length;

  let score = 70;
  if (hasAll) score += 15;

  // 最佳篇幅長度 15 ~ 60 字
  if (len >= 15 && len <= 60) {
    score += 8;
  } else if (len > 60) {
    score += 4;
  }

  // 修辭標記加分（對比、銜接、哲理）
  const markers = [
    '以', '而', '不', '又', '豈', '縱', '若', '天下', '古人', '今日', '鍵盤', '凡',
    '何須', '何必', '？', '！', '雖然', '但是', '既然', '如此', '特別', '究竟', '如此', '自然'
  ];
  let foundCount = 0;
  markers.forEach(m => {
    if (clean.includes(m)) foundCount++;
  });
  score += Math.min(7, foundCount * 2);

  // 限制最高 98
  score = Math.min(98, score);
  const passed = score >= 80;

  let verdict = "尚待推敲";
  if (score >= 90) verdict = "錦心繡口";
  else if (score >= 85) verdict = "文思敏捷";
  else if (passed) verdict = "通達暢達";

  let critique = "";
  if (passed) {
    critique = `文句成功將【${tiles.join('】與【')}】渾然融入同一語境，文脈舒展自然，上下文語意足供精準消歧，展現出高度的文字織錦技巧。`;
  } else {
    critique = `詞塊雖皆已入列，但文脈銜接略顯緊促，建議再多鋪陳情境、運用連接詞擴充前後語境。`;
  }

  return {
    score: score,
    passed: passed,
    verdict: verdict,
    critique: critique,
    pithy_quote: clean
  };
}

// 7. 送出評分與雙向賦能體驗
async function handleEvaluate() {
  const currentChal = state.challenges[state.currentIndex];
  const sentence = state.currentSentence || "";

  // 驗證是否所有詞塊都已出現
  const missing = state.currentTilesOrder.filter(t => !sentence.includes(t));
  if (missing.length > 0) {
    alert(`尚未完整織入所有詞塊！缺少：${missing.join('、')}`);
    return;
  }

  dom.btnEval.disabled = true;
  dom.btnEval.innerHTML = `<span>⏳ 文心鑑賞中...</span>`;

  // 模擬沉思體驗
  await new Promise(r => setTimeout(r, 450));

  let evalData = null;

  // 若使用者本機有啟動 server.py，優先嘗試後端 AI
  try {
    const res = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challenge_id: currentChal.id,
        title: currentChal.title,
        tiles: state.currentTilesOrder,
        sentence: sentence
      })
    });
    if (res.ok) {
      evalData = await res.json();
    }
  } catch (e) {
    // 靜態模式無後端，由純前端引擎評分
  }

  // 純前端啟發式引擎評分
  if (!evalData) {
    evalData = evaluateLocally(sentence, state.currentTilesOrder, currentChal.title);
  }

  // 80分合格時，記錄至瀏覽器本機金句庫 (localStorage)
  if (evalData.score >= 80) {
    try {
      const stored = JSON.parse(localStorage.getItem('textile_golden_quotes') || '[]');
      stored.push({
        id: currentChal.id,
        title: currentChal.title,
        sentence: sentence,
        score: evalData.score,
        date: new Date().toISOString()
      });
      localStorage.setItem('textile_golden_quotes', JSON.stringify(stored));
    } catch (e) {
      console.warn("無法存入 localStorage", e);
    }
  }

  // 快取本題成果
  state.evalCache[currentChal.id] = {
    tilesOrder: [...state.currentTilesOrder],
    slotInputs: [...state.slotInputs],
    evalResult: evalData
  };

  showCritique(evalData);

  dom.btnEval.disabled = false;
  dom.btnEval.innerHTML = `<span>織句鑑賞</span> <span>✦</span>`;
}

// 8. 顯示評分卡片
function showCritique(evalData) {
  dom.scoreNumber.textContent = evalData.score;
  dom.verdictSeal.textContent = evalData.verdict || (evalData.score >= 80 ? "錦心繡口" : "尚待推敲");
  dom.critiqueBody.textContent = evalData.critique;
  dom.critiqueQuote.textContent = `「${evalData.pithy_quote || state.currentSentence}」`;

  // 雙向賦能狀態條
  if (evalData.score >= 80) {
    dom.verdictSeal.style.borderColor = "var(--accent-cinnabar)";
    dom.verdictSeal.style.color = "var(--accent-cinnabar)";
    dom.commitStatus.className = "commit-status-box commit-status-success";
    dom.commitStatus.innerHTML = `
      <span>🏛️</span>
      <span><strong>線上鑑賞通過！</strong> 已典藏至本機瀏覽器。此機制由【如喜輸入法 (RuhI)】驅動，在桌面版中本句將即時化為輸入法神經消歧突觸！</span>
    `;
    dom.btnEval.style.display = 'none';
    dom.btnPrevInline.style.display = 'inline-flex';
    dom.btnReweave.style.display = 'inline-flex';
    dom.btnNextInline.style.display = 'inline-flex';
  } else {
    dom.verdictSeal.style.borderColor = "var(--ink-muted)";
    dom.verdictSeal.style.color = "var(--ink-muted)";
    dom.commitStatus.className = "commit-status-box commit-status-warning";
    dom.commitStatus.innerHTML = `
      <span>🛡️</span>
      <span>未達 80 分門檻。請再推敲上下文、增加情境銜接修辭後重新鑑賞！</span>
    `;
    dom.btnEval.style.display = 'inline-flex';
    dom.btnPrevInline.style.display = 'none';
    dom.btnReweave.style.display = 'none';
    dom.btnNextInline.style.display = 'none';
  }

  dom.critiqueCard.classList.add('show');
}

function hideCritique() {
  dom.critiqueCard.classList.remove('show');
  dom.btnEval.style.display = 'inline-flex';
  dom.btnPrevInline.style.display = 'none';
  dom.btnReweave.style.display = 'none';
  dom.btnNextInline.style.display = 'none';
}

// 工具：防 XSS
function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// 9. 綁定全域事件
function setupEventListeners() {
  dom.btnPrev.addEventListener('click', () => loadChallenge(state.currentIndex - 1));
  dom.btnNext.addEventListener('click', () => loadChallenge(state.currentIndex + 1));

  dom.btnPrevInline.addEventListener('click', () => {
    loadChallenge(state.currentIndex - 1);
  });

  dom.btnNextInline.addEventListener('click', () => {
    loadChallenge(state.currentIndex + 1);
  });

  dom.btnReset.addEventListener('click', () => {
    state.slotInputs = new Array(state.currentTilesOrder.length + 1).fill("");
    renderStage();
    updateLivePreview();
    hideCritique();
  });

  dom.btnReweave.addEventListener('click', () => {
    state.currentTilesOrder.reverse();
    state.slotInputs = new Array(state.currentTilesOrder.length + 1).fill("");
    renderStage();
    updateLivePreview();
    hideCritique();

    setTimeout(() => {
      const firstInput = dom.weavingTrack.querySelector('.slot-input');
      if (firstInput) firstInput.focus();
    }, 50);
  });

  dom.btnEval.addEventListener('click', handleEvaluate);

  // 模式切換按鈕
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.mode = e.target.dataset.mode;
    });
  });

  // 快捷鍵：Ctrl+Enter 鑑賞
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      dom.btnEval.click();
    }
  });
}

// 啟動
window.addEventListener('DOMContentLoaded', init);
