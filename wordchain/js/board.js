/**
 * 字戀 (WordChain) - [第四章] 二維縱橫字陣棋盤引擎 (CrossBoardGrid Engine)
 * 職責：
 * 1. 2D 漢字交錯落子演算法 (同字硬咬、同音樞紐格判定、正交垂直自然推進)
 * 2. 氣泡空間避障演算法 (Bubble Collision Avoidance)
 * 3. 樞紐格三種呈現模式渲染：方案 A 合璧雙字磚、方案 B 雙星音律橋、方案 C 太極翻轉牌
 * 4. 畫布尺寸動態延伸與最新落子焦點平滑滾動
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WordChain = root.WordChain || {};
    root.WordChain.Board = factory();
    Object.assign(root, root.WordChain.Board);
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ==========================================
  // 1. 氣泡空間避障演算法 (Bubble Collision Avoidance)
  // ==========================================
  function findClearBubblePosition(boardMap, placedCoords, isEvenRound, direction) {
    const wordMinRow = Math.min(...placedCoords.map(p => p.row));
    const wordMaxRow = Math.max(...placedCoords.map(p => p.row));
    const wordMinCol = Math.min(...placedCoords.map(p => p.col));
    const wordMaxCol = Math.max(...placedCoords.map(p => p.col));
    const midRow = Math.round((wordMinRow + wordMaxRow) / 2);
    const midCol = Math.round((wordMinCol + wordMaxCol) / 2);

    const bWidth = 210;
    const bHeight = 52;

    const candRight = {
      arrowClass: 'arrow-left',
      bLeft: (wordMaxCol + 1) * 44 + 10,
      bTop: Math.max(10, midRow * 44 + 10),
      c1: wordMaxCol + 1,
      c2: Math.floor(((wordMaxCol + 1) * 44 + 10 + bWidth - 1) / 44),
      r1: Math.floor(Math.max(10, midRow * 44 + 10) / 44),
      r2: Math.floor((Math.max(10, midRow * 44 + 10) + bHeight - 1) / 44)
    };

    const candLeft = {
      arrowClass: 'arrow-right',
      bLeft: wordMinCol * 44 - bWidth - 10,
      bTop: Math.max(10, midRow * 44 + 10),
      c1: Math.floor((wordMinCol * 44 - bWidth - 10) / 44),
      c2: wordMinCol - 1,
      r1: Math.floor(Math.max(10, midRow * 44 + 10) / 44),
      r2: Math.floor((Math.max(10, midRow * 44 + 10) + bHeight - 1) / 44)
    };

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
      if (collisions === 0) return c;
      if (collisions < minColls) {
        minColls = collisions;
        best = c;
      }
    }
    return best || (candRight.bLeft >= 10 ? candRight : candBelow);
  }

  // ==========================================
  // 2. 樞紐格呈現渲染 (renderHomoCell)
  // ==========================================
  function renderHomoCell(cell, cellData, homoStyle = "tile") {
    const P = (typeof window !== 'undefined' && window.WordChain && window.WordChain.Phonetics) || {};
    const checkMatchFn = P.checkPhoneticMatch || (() => null);
    const getZhFn = P.getCharZhuyin || (() => "");

    const prevC = cellData.prevChar;
    const nextC = cellData.char;
    const matchCheck = (prevC && nextC) ? checkMatchFn(prevC, nextC, true, false, cellData.prevWord, cellData.word) : null;
    const sharedZh = cellData.matchingZhuyin || (matchCheck && matchCheck.matchingZhuyin) || getZhFn(nextC) || getZhFn(prevC) || "—";
    const speaker = cellData.speaker || "player";

    if (homoStyle === "bridge") {
      cell.className = `board-cell ${speaker} cross-pivot cross-pivot-homo style-bridge`;
      cell.innerHTML = `
        <div class="homo-bridge-box" title="上一詞尾字「${prevC}」➔ 接招首字「${nextC}」(同音：${sharedZh})">
          <div class="bead bead-prev">${prevC}</div>
          <div class="bridge-link"></div>
          <div class="bead bead-next">${nextC}</div>
        </div>
        <span class="cell-ruby" style="color:#2ed573; font-weight:bold; font-size:0.5rem; margin-top:2px;">${sharedZh}</span>
      `;
    } else if (homoStyle === "flip") {
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
        if (typeof showToast === 'function') {
          if (cell.classList.contains("paused")) {
            showToast(`⏸️ 【${motionDesc}】已定格，再次點擊恢復流轉`, "info", 1500);
          } else {
            showToast(`▶️ 【${motionDesc}】已恢復流轉`, "info", 1500);
          }
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

  // ==========================================
  // 3. 落子與畫布延伸佈局引擎 (placeWordOnBoard)
  // ==========================================
  function placeWordOnBoard(engine, word, speakerType, banterText, isPlayer = false, isInitial = false, isDemo = false) {
    const P = (typeof window !== 'undefined' && window.WordChain && window.WordChain.Phonetics) || {};
    const checkMatchFn = P.checkPhoneticMatch || (() => null);
    const getZhFn = P.getCharZhuyin || (() => "");

    const gridId = isDemo ? "demo-board-grid" : "cross-board-grid";
    const viewportId = isDemo ? "demo-board-viewport" : "cross-board-viewport";
    const cellPrefix = isDemo ? "demo-cell-" : "cell-";

    const grid = document.getElementById(gridId);
    if (!grid) return;

    const boardMap = isDemo ? engine.demoBoardMap : engine.boardMap;
    const chars = word.split("");
    const L = chars.length;
    const placedCoords = [];

    if (isInitial) {
      const startRow = 1;
      const startCol = 1;
      for (let i = 0; i < L; i++) {
        const r = startRow;
        const c = startCol + i;
        const ch = chars[i];
        const zh = getZhFn(ch);
        boardMap.set(`${r},${c}`, { char: ch, speaker: speakerType, zhuyin: zh, isPivot: false, word: word });
        placedCoords.push({ row: r, col: c, char: ch, isPivot: false });
      }
      if (isDemo) {
        engine.demoLastTailCoord = { row: startRow, col: startCol + L - 1 };
        engine.demoLastDirection = 'horizontal';
      } else {
        engine.lastTailCoord = { row: startRow, col: startCol + L - 1 };
        engine.lastDirection = 'horizontal';
      }
    } else {
      const prevTail = isDemo ? engine.demoLastTailCoord : engine.lastTailCoord;
      const lastDir = isDemo ? engine.demoLastDirection : engine.lastDirection;
      const prevKey = `${prevTail.row},${prevTail.col}`;
      let isHomoPivot = false;
      let prevChar = "";

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
          const matchResult = checkMatchFn(prevChar, chars[0], true, false, prevData.word, word);
          if (matchResult && matchResult.matchingZhuyin) {
            prevData.matchingZhuyin = matchResult.matchingZhuyin;
          }
          prevData.word = word;
        }
        prevData.isPivot = true;
      }

      const newDir = (lastDir === 'horizontal') ? 'vertical' : 'horizontal';

      if (newDir === 'vertical') {
        placedCoords.push({ row: prevTail.row, col: prevTail.col, char: chars[0], isPivot: true, isHomo: isHomoPivot, prevChar: prevChar, speaker: speakerType });
        for (let i = 1; i < L; i++) {
          const r = prevTail.row + i;
          const c = prevTail.col;
          const ch = chars[i];
          const zh = getZhFn(ch);
          boardMap.set(`${r},${c}`, { char: ch, speaker: speakerType, zhuyin: zh, isPivot: false, word: word });
          placedCoords.push({ row: r, col: c, char: ch, isPivot: false, speaker: speakerType });
        }
        if (isDemo) {
          engine.demoLastTailCoord = { row: prevTail.row + L - 1, col: prevTail.col };
          engine.demoLastDirection = 'vertical';
        } else {
          engine.lastTailCoord = { row: prevTail.row + L - 1, col: prevTail.col };
          engine.lastDirection = 'vertical';
        }
      } else {
        placedCoords.push({ row: prevTail.row, col: prevTail.col, char: chars[0], isPivot: true, isHomo: isHomoPivot, prevChar: prevChar, speaker: speakerType });
        for (let i = 1; i < L; i++) {
          const r = prevTail.row;
          const c = prevTail.col + i;
          const ch = chars[i];
          const zh = getZhFn(ch);
          boardMap.set(`${r},${c}`, { char: ch, speaker: speakerType, zhuyin: zh, isPivot: false, word: word });
          placedCoords.push({ row: r, col: c, char: ch, isPivot: false, speaker: speakerType });
        }
        if (isDemo) {
          engine.demoLastTailCoord = { row: prevTail.row, col: prevTail.col + L - 1 };
          engine.demoLastDirection = 'horizontal';
        } else {
          engine.lastTailCoord = { row: prevTail.row, col: prevTail.col + L - 1 };
          engine.lastDirection = 'horizontal';
        }
      }
    }

    for (const p of placedCoords) {
      if (isDemo) {
        if (p.row < engine.demoMinRow) engine.demoMinRow = p.row;
        if (p.row > engine.demoMaxRow) engine.demoMaxRow = p.row;
        if (p.col < engine.demoMinCol) engine.demoMinCol = p.col;
        if (p.col > engine.demoMaxCol) engine.demoMaxCol = p.col;
      } else {
        if (p.row < engine.minRow) engine.minRow = p.row;
        if (p.row > engine.maxRow) engine.maxRow = p.row;
        if (p.col < engine.minCol) engine.minCol = p.col;
        if (p.col > engine.maxCol) engine.maxCol = p.col;
      }
    }

    const curMaxCol = isDemo ? engine.demoMaxCol : engine.maxCol;
    const curMaxRow = isDemo ? engine.demoMaxRow : engine.maxRow;
    const gridW = Math.max(1200, (curMaxCol + 16) * 44);
    const gridH = Math.max(800, (curMaxRow + 16) * 44);
    grid.style.width = `${gridW}px`;
    grid.style.height = `${gridH}px`;

    placedCoords.forEach(p => {
      const cellId = `${cellPrefix}${p.row}-${p.col}`;
      let cell = document.getElementById(cellId);
      const zh = getZhFn(p.char);

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

      if (p.isPivot) {
        if (p.isHomo && p.prevChar && p.prevChar !== p.char) {
          renderHomoCell(cell, p, engine.homoStyle || "tile");
        } else {
          cell.classList.add("cross-pivot");
        }
      }
    });

    const oldBubbles = Array.from(grid.querySelectorAll(".board-bubble"));
    oldBubbles.forEach(b => {
      if (b && b.parentNode) b.parentNode.removeChild(b);
    });

    const viewport = document.getElementById(viewportId);
    if (viewport) {
      let minX = Math.min(...placedCoords.map(p => p.col * 44));
      let maxX = Math.max(...placedCoords.map(p => (p.col + 1) * 44));
      let minY = Math.min(...placedCoords.map(p => p.row * 44));
      let maxY = Math.max(...placedCoords.map(p => (p.row + 1) * 44));

      const PADDING = 100;
      const roiMinX = Math.max(0, minX - PADDING);
      const roiMaxX = maxX + PADDING;
      const roiMinY = Math.max(0, minY - PADDING);
      const roiMaxY = maxY + PADDING;

      setTimeout(() => {
        const currentScale = viewport._zoomScale || 1.0;
        let targetScrollLeft, targetScrollTop;

        if (isInitial) {
          targetScrollLeft = Math.max(0, (minX * currentScale) - 16);
          targetScrollTop = Math.max(0, (minY * currentScale) - 16);
        } else {
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

  return {
    findClearBubblePosition,
    renderHomoCell,
    placeWordOnBoard
  };
});
