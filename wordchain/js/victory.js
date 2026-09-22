/**
 * 字戀 (WordChain) - [第七章] 4K 印刷級戰報與向量匯出 (Victory & Export Engine)
 * 職責：
 * 1. 生成 4K 超高解析 (2400x3120 A4 印刷級) Canvas 2D 典雅朱印證書 PNG
 * 2. 生成無限放大全向量 SVG 證書
 * 3. 一鍵下載全向量 SVG、開啟純淨列印視窗 / 另存為 PDF
 * 4. 複製 4K 證書圖卡與社群排版文案至剪貼簿
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WordChain = root.WordChain || {};
    root.WordChain.Victory = factory();
    Object.assign(root, root.WordChain.Victory);
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ==========================================
  // 1. 生成戰報圖卡 (Canvas 2D 2400x3120 A4 印刷級 PNG)
  // ==========================================
  function generateVictoryCardCanvas(engine, scale = 3.0) {
    const baseW = 800;
    const baseH = 1040;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(baseW * scale);
    canvas.height = Math.round(baseH * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;

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

    // 4. 右上角朱紅斜角官印
    const isWin = (engine.lastIsPlayerWinner !== false);
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
    ctx.fillText(isWin ? "字 戀 狂 認 證" : "文 壇 名 士 印", 0, 0);
    ctx.restore();

    // 5. 頂部皇冠與大標題
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "56px 'Segoe UI Emoji', sans-serif";
    ctx.fillText(isWin ? "👑" : "🎖️", width / 2, 120);

    ctx.font = "900 46px 'Noto Serif TC', serif, sans-serif";
    ctx.fillStyle = "#f1c40f";
    ctx.shadowColor = "rgba(241, 196, 15, 0.6)";
    ctx.shadowBlur = 18;
    ctx.fillText(engine.lastVictoryTitle || "您這個完美字戀狂！", width / 2, 195);
    ctx.shadowBlur = 0;

    const P = (typeof window !== 'undefined' && window.WordChain && window.WordChain.Personas) || {};
    const personasDict = P.PERSONAS || {};
    const persona = personasDict[engine.currentPersona] || { name: "紀曉嵐" };

    ctx.font = "500 20px 'Noto Sans TC', sans-serif";
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(engine.lastVictorySubtitle || `滿腹經綸，威震文壇；${persona.name} 氣血耗盡，甘拜下風！`, width / 2, 250);

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
      { lbl: "對弈回合", val: `${engine.roundCount} 輪` },
      { lbl: "最長詞格", val: engine.lastLongestWord || `${engine.battleCurrentWord} (4字)` },
      { lbl: "極速出招", val: engine.lastSpeedStr || "1.0s" },
      { lbl: "終局戰分", val: `${engine.playerScore} vs ${engine.aiScore}` }
    ];

    const colW = boxW / 4;
    statsCols.forEach((col, idx) => {
      const cx = boxX + colW * idx + colW / 2;
      ctx.font = "500 16px 'Noto Sans TC', sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(col.lbl, cx, boxY + 45);

      if (idx === 1) {
        const bw = engine.lastBestWord || (engine.battleCurrentWord || "四字成語");
        const blen = engine.lastBestLen || bw.length;
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

    const rankTitle = engine.lastRankTitle || "👑 傳奇 · 完美字戀狂";
    ctx.font = "bold 20px 'Noto Sans TC', sans-serif";
    ctx.fillStyle = "#f1c40f";
    ctx.fillText(`🏅 榮譽頭銜：${rankTitle}`, width / 2, rankY + rankH / 2);

    // 7.05 特賞膠囊
    let homoShift = 0;
    if (engine.lastHomoBadge) {
      homoShift = 42;
      const homoY = 525;
      const homoW = 540;
      const homoH = 34;
      const homoX = (width - homoW) / 2;

      const isPun = (engine.lastBadgeType === "pun");
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
      ctx.fillText(engine.lastHomoBadge, width / 2, homoY + homoH / 2);
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

    const carTitle = engine.lastCareer ? engine.lastCareer.title : "【跨界大斜槓奇才】";
    const carDesc = engine.lastCareer ? engine.lastCareer.desc : "您該不會是各界深藏不露的隱世掃地僧吧？";

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
    ctx.fillText(`🚩 終局題目：【${engine.battleCurrentWord}】`, width / 2, quoteY + 42);

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
  // 2. 生成全向量 SVG 證書
  // ==========================================
  function generateVictoryCardSVG(engine) {
    const width = 800;
    const height = 1040;
    const P = (typeof window !== 'undefined' && window.WordChain && window.WordChain.Personas) || {};
    const personasDict = P.PERSONAS || {};
    const persona = personasDict[engine.currentPersona] || { name: "紀曉嵐" };

    const rankTitle = engine.lastRankTitle || "👑 傳奇 · 完美字戀狂";
    const carTitle = engine.lastCareer ? engine.lastCareer.title : "【跨界大斜槓奇才】";
    const carDesc = engine.lastCareer ? engine.lastCareer.desc : "您該不會是各界深藏不露的隱世掃地僧吧？";
    const bw = engine.lastBestWord || (engine.battleCurrentWord || "四字成語");
    const blen = engine.lastBestLen || bw.length;
    let wordDisplay = bw;
    let wordFontSize = 22;
    if (blen > 10) {
      wordFontSize = 12;
      if (wordDisplay.length > 12) wordDisplay = wordDisplay.slice(0, 11) + '…';
    } else if (blen >= 8) wordFontSize = 13;
    else if (blen >= 6) wordFontSize = 15;
    else if (blen >= 5) wordFontSize = 17;
    const speedStr = engine.lastSpeedStr || "1.0s";
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

  <rect width="${width}" height="${height}" fill="url(#bgGrad)"/>
  ${gridLines}

  <rect x="28" y="28" width="${width - 56}" height="${height - 56}" fill="none" stroke="#f1c40f" stroke-width="4"/>
  <rect x="36" y="36" width="${width - 72}" height="${height - 72}" fill="none" stroke="#f1c40f" stroke-opacity="0.4" stroke-width="1.5"/>

  <path d="M 68 44 L 44 44 L 44 68" fill="none" stroke="#f1c40f" stroke-width="2.5"/>
  <path d="M ${width - 68} 44 L ${width - 44} 44 L ${width - 44} 68" fill="none" stroke="#f1c40f" stroke-width="2.5"/>
  <path d="M 68 ${height - 44} L 44 ${height - 44} L 44 ${height - 68}" fill="none" stroke="#f1c40f" stroke-width="2.5"/>
  <path d="M ${width - 68} ${height - 44} L ${width - 44} ${height - 44} L ${width - 44} ${height - 68}" fill="none" stroke="#f1c40f" stroke-width="2.5"/>

  <g transform="translate(${width - 130}, 95) rotate(12)">
    <rect x="-65" y="-22" width="130" height="44" fill="#c0392b" fill-opacity="0.9"/>
    <rect x="-61" y="-18" width="122" height="36" fill="none" stroke="#e74c3c" stroke-width="3"/>
    <text x="0" y="5" font-family="'Noto Serif TC', serif" font-weight="bold" font-size="18" fill="#ffffff" text-anchor="middle">字 戀 狂 認 證</text>
  </g>

  <text x="${width / 2}" y="130" font-size="56" text-anchor="middle">👑</text>
  <text x="${width / 2}" y="195" font-family="'Noto Serif TC', serif" font-weight="900" font-size="46" fill="#f1c40f" text-anchor="middle" filter="url(#goldGlow)">${engine.lastVictoryTitle || "您這個完美字戀狂！"}</text>
  <text x="${width / 2}" y="250" font-family="'Noto Sans TC', sans-serif" font-weight="500" font-size="20" fill="#cbd5e1" text-anchor="middle">滿腹經綸，威震文壇；${persona.name} 氣血耗盡，甘拜下風！</text>

  <g transform="translate(60, 295)">
    <rect width="${width - 120}" height="150" fill="#000000" fill-opacity="0.45" stroke="#ffffff" stroke-opacity="0.12" stroke-width="1"/>
    <text x="85" y="45" font-family="'Noto Sans TC', sans-serif" font-size="16" fill="#94a3b8" text-anchor="middle">對弈回合</text>
    <text x="85" y="95" font-family="'Noto Sans TC', sans-serif" font-weight="bold" font-size="24" fill="#00cec9" text-anchor="middle">${engine.roundCount} 輪</text>
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
    <text x="595" y="95" font-family="'Noto Sans TC', sans-serif" font-weight="bold" font-size="24" fill="#00cec9" text-anchor="middle">${engine.playerScore} 分</text>
  </g>

  <g transform="translate(${(width - 440) / 2}, 475)">
    <rect width="440" height="44" rx="22" fill="#f1c40f" fill-opacity="0.15" stroke="#f1c40f" stroke-opacity="0.5" stroke-width="1.5"/>
    <text x="220" y="28" font-family="'Noto Sans TC', sans-serif" font-weight="bold" font-size="20" fill="#f1c40f" text-anchor="middle">🏅 榮譽頭銜：${rankTitle}</text>
  </g>

  ${engine.lastHomoBadge ? `
  <g transform="translate(${(width - 540) / 2}, 525)">
    <rect width="540" height="34" rx="17" fill="${engine.lastBadgeType === 'pun' ? '#2ed573' : '#00cec9'}" fill-opacity="0.16" stroke="${engine.lastBadgeType === 'pun' ? '#2ed573' : '#00cec9'}" stroke-opacity="0.55" stroke-width="1.2"/>
    <text x="270" y="22" font-family="'Noto Sans TC', sans-serif" font-weight="bold" font-size="14" fill="${engine.lastBadgeType === 'pun' ? '#2ed573' : '#00cec9'}" text-anchor="middle">${engine.lastHomoBadge}</text>
  </g>` : ''}

  <g transform="translate(70, ${engine.lastHomoBadge ? 570 : 545})">
    <rect width="${width - 140}" height="${engine.lastHomoBadge ? 100 : 110}" rx="12" fill="url(#carGrad)" stroke="#e67e22" stroke-opacity="0.4" stroke-width="1.2"/>
    <text x="${(width - 140) / 2}" y="26" font-family="'Noto Sans TC', sans-serif" font-weight="bold" font-size="13" fill="#e67e22" text-anchor="middle">🔮 詞海八字 · 職業神算推測</text>
    <text x="${(width - 140) / 2}" y="56" font-family="'Noto Serif TC', serif" font-weight="bold" font-size="20" fill="#f39c12" text-anchor="middle">${carTitle}</text>
    <text x="${(width - 140) / 2}" y="84" font-family="'Noto Sans TC', sans-serif" font-size="14" fill="#f1f5f9" text-anchor="middle">「${carDesc}」</text>
  </g>

  <g transform="translate(70, 675)">
    <rect width="${width - 140}" height="135" rx="12" fill="#121826" fill-opacity="0.85" stroke="#00cec9" stroke-opacity="0.35" stroke-width="1.2"/>
    <text x="${(width - 140) / 2}" y="42" font-family="'Noto Sans TC', sans-serif" font-weight="bold" font-size="17" fill="#00cec9" text-anchor="middle">🚩 終局題目：【${engine.battleCurrentWord}】</text>
    <text x="${(width - 140) / 2}" y="88" font-family="'Noto Serif TC', serif" font-style="italic" font-size="20" fill="#f1f5f9" text-anchor="middle">「文思泉湧，詞海弄潮！敢問閣下——您今天字戀了沒？」</text>
  </g>

  <text x="${width / 2}" y="850" font-family="'Noto Sans TC', sans-serif" font-weight="500" font-size="16" fill="#64748b" text-anchor="middle">臺灣教育部重編國語辭典 · 中華文采字陣對弈雅苑</text>
  <text x="${width / 2}" y="885" font-family="monospace, sans-serif" font-weight="bold" font-size="19" fill="#f1c40f" text-anchor="middle">https://yuktesha.github.io/wordchain/</text>
  <text x="${width / 2}" y="935" font-family="'Noto Sans TC', sans-serif" font-size="14" fill="#475569" text-anchor="middle">戰報產出時間：${dateStr} · 獨家傳世授權認證</text>
</svg>`;
    return svg;
  }

  // ==========================================
  // 3. 下載全向量證書與高解析列印 / 存為 PDF
  // ==========================================
  function downloadVictoryPDF(engine) {
    const svgContent = generateVictoryCardSVG(engine);
    const rank = (engine.lastRankTitle || "完美字戀狂").replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");
    const fileName = `字戀狂勝戰證書-${rank}-${Date.now()}`;

    const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);

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

    if (typeof showToast === 'function') {
      showToast("🎉 已下載全向量證書 (SVG) 並開啟 A4 列印/另存 PDF 視窗！", "success", 4500);
    }
  }

  return {
    generateVictoryCardCanvas,
    generateVictoryCardSVG,
    downloadVictoryPDF
  };
});
