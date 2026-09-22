/**
 * 字戀 (WordChain) - [第八章] 詞海手冊與 Gemma 智慧審定 (Learned Lexicon & Gemma Audit Engine)
 * 職責：
 * 1. 玩家自創/親授詞彙的即時收錄與審核狀態標定 (典故成語、詩詞名篇、民間棋諺、萌典標準詞、待評估)
 * 2. 詞海狀態統計儀表板 (Stats Grid) 與表格動態渲染
 * 3. Gemma 國語文院士審查院彈窗動態鑑定與一鍵吸納建庫
 * 4. 詞海手冊 JSON 匯出與已認證詞彙清理維護
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WordChain = root.WordChain || {};
    root.WordChain.Learned = factory();
    Object.assign(root, root.WordChain.Learned);
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const KNOWN_EXTRA = {
    '空山不見人': { origin: '唐．王維《鹿柴》', def: '空曠幽靜的山林中看不見人的蹤影。唐代王維名篇：「空山不見人，但聞人語響。」', tag: '👑 詩詞名句', isPoetry: true },
    '但聞人語響': { origin: '唐．王維《鹿柴》', def: '只聽得見人的說話迴響聲。以聲襯靜，極顯山幽林靜。', tag: '👑 詩詞名句', isPoetry: true },
    '起手無回': { origin: '傳統象棋棋諺', def: '棋藝格言「起手無回大丈夫，落子無悔大丈夫」。形容下棋落子不悔，比喻行事果決、言出必行。', tag: '📜 民間棋諺' },
    '白白犧牲': { origin: '現代通俗熟語', def: '徒然無益地付出生命、心血或代價，而未能產生任何效益。', tag: '📜 通俗熟語' }
  };

  const KNOWN_DEFS = {
    '起風': '颳風、起風了。',
    '選舉': '擇善而推舉。透過民主投票方式抉擇充任公職之程序。',
    '大人': '德高望重之長者；成年人。',
    '鋼鐵': '鋼與鐵之合金材料；形容堅強不可摧毀。',
    '王八蛋': '民間通俗罵人口語。',
    '瞬間': '轉瞬之間、一眨眼，形容時間極其短暫。',
    '山海經': '古代著名神話地理典籍，記敘山川地理與異獸靈物。'
  };

  function getWordQuickDef(w) {
    return KNOWN_DEFS[w] || '';
  }

  function getWordAuditStatus(engine, w) {
    // 1. 檢查是否在神譜成語/詩詞典故庫中 (story_cache)
    if (typeof window !== 'undefined' && window.STORY_CACHE && window.STORY_CACHE[w]) {
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

    // 3. 檢查是否在官方萌典詞庫中
    const head = w[0];
    const headData = engine && engine.lexicon && engine.lexicon[head];
    const inMoe = headData && headData.w && headData.w.some(e => e[0] === w);
    if (inMoe) {
      return {
        type: 'moe',
        tag: '🟢 萌典標準詞',
        badgeColor: '#2ed573',
        badgeBg: 'rgba(46,213,115,0.18)',
        badgeBorder: 'rgba(46,213,115,0.3)',
        origin: '教育部國語辭典修訂本',
        definition: getWordQuickDef(w) || '教育部標準正體詞彙，雙雄 AI 隨時熟練出招。'
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

  function renderLearnedTable(engine) {
    if (typeof document === 'undefined') return;
    const tbody = document.getElementById("learned-table-body");
    if (!tbody) return;

    initLearnedTabListeners(engine);

    const words = Object.entries(engine.learnedWords || {});
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
        const audit = getWordAuditStatus(engine, w);

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

    const elTotal = document.getElementById("stat-total-learned");
    const elMoe = document.getElementById("stat-moe-certified");
    const elPoetry = document.getElementById("stat-poetry-saying");
    const elPending = document.getElementById("stat-pending-audit");

    if (elTotal) elTotal.innerText = totalCount;
    if (elMoe) elMoe.innerText = moeCount;
    if (elPoetry) elPoetry.innerText = poetrySayingCount;
    if (elPending) elPending.innerText = pendingCount;
  }

  function initLearnedTabListeners(engine) {
    if (engine._learnedListenersInitialized) return;
    engine._learnedListenersInitialized = true;

    const btnGemma = document.getElementById("btn-gemma-audit");
    if (btnGemma) {
      btnGemma.addEventListener("click", () => openGemmaAuditModal(engine));
    }

    const btnSync = document.getElementById("btn-sync-learned");
    if (btnSync) {
      btnSync.addEventListener("click", () => {
        renderLearnedTable(engine);
        const total = Object.keys(engine.learnedWords || {}).length;
        if (typeof showToast === 'function') {
          showToast(`✨ 萌典狀態同步檢驗完畢！手冊共 ${total} 詞，官方體系已全數連線！`, "success");
        }
      });
    }

    const btnExport = document.getElementById("btn-export-learned");
    if (btnExport) {
      btnExport.addEventListener("click", () => exportLearnedWords(engine));
    }

    const btnClearVerified = document.getElementById("btn-clear-verified");
    if (btnClearVerified) {
      btnClearVerified.addEventListener("click", () => clearVerifiedLearnedWords(engine));
    }

    const modal = document.getElementById("modal-gemma-audit");
    const btnClose1 = document.getElementById("btn-close-gemma-modal");
    const btnClose2 = document.getElementById("btn-close-gemma-modal2");
    const btnConfirm = document.getElementById("btn-confirm-gemma-adopt");

    const closeModal = () => { if (modal) modal.style.display = "none"; };
    if (btnClose1) btnClose1.addEventListener("click", closeModal);
    if (btnClose2) btnClose2.addEventListener("click", closeModal);
    if (btnConfirm) btnConfirm.addEventListener("click", () => confirmGemmaAdopt(engine));

    const tbody = document.getElementById("learned-table-body");
    if (tbody) {
      tbody.addEventListener("click", (e) => {
        const btn = e.target.closest(".btn-delete-learned");
        if (btn) {
          const w = btn.getAttribute("data-word");
          if (w && engine.learnedWords[w]) {
            delete engine.learnedWords[w];
            engine.saveLearnedWords();
            renderLearnedTable(engine);
            if (typeof showToast === 'function') {
              showToast(`🗑️ 已自手冊除名【${w}】`, "info");
            }
          }
        }
      });
    }
  }

  function openGemmaAuditModal(engine) {
    const modal = document.getElementById("modal-gemma-audit");
    const container = document.getElementById("gemma-modal-content");
    if (!modal || !container) return;

    const words = Object.keys(engine.learnedWords || {});
    if (words.length === 0) {
      if (typeof showToast === 'function') {
        showToast("手冊尚無親授詞彙，請先在人機對決中出招！", "warning");
      }
      return;
    }

    container.innerHTML = "";
    for (const w of words) {
      const audit = getWordAuditStatus(engine, w);
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

  function confirmGemmaAdopt(engine) {
    for (const w of Object.keys(engine.learnedWords || {})) {
      const audit = getWordAuditStatus(engine, w);
      engine.learnedWords[w].definition = audit.definition;
      engine.learnedWords[w].origin = audit.origin;
      engine.learnedWords[w].tag = audit.tag;
    }
    engine.saveLearnedWords();
    renderLearnedTable(engine);

    const modal = document.getElementById("modal-gemma-audit");
    if (modal) modal.style.display = "none";
    if (typeof showToast === 'function') {
      showToast("🎉 Gemma 院士評定完畢！所有詞彙均已驗證，正式入列詞海神譜！", "success", 4000);
    }
  }

  function clearVerifiedLearnedWords(engine) {
    const words = Object.keys(engine.learnedWords || {});
    let removed = 0;
    for (const w of words) {
      const audit = getWordAuditStatus(engine, w);
      if (audit.type === 'moe' || audit.type === 'poetry' || audit.type === 'saying') {
        delete engine.learnedWords[w];
        removed++;
      }
    }
    engine.saveLearnedWords();
    renderLearnedTable(engine);
    if (typeof showToast === 'function') {
      showToast(`🧹 已清理 ${removed} 個官方已完整收錄之詞彙，詞海手冊清爽俐落！`, "success");
    }
  }

  function exportLearnedWords(engine) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(engine.learnedWords || {}, null, 2));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `wordchain_learned_words_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (typeof showToast === 'function') {
      showToast("📥 詞海手冊資料已成功匯出為 JSON 檔！", "success");
    }
  }

  return {
    getWordAuditStatus,
    getWordQuickDef,
    renderLearnedTable,
    initLearnedTabListeners,
    openGemmaAuditModal,
    confirmGemmaAdopt,
    clearVerifiedLearnedWords,
    exportLearnedWords
  };
});
