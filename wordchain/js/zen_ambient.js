/**
 * 字戀 (WordChain) - [第十章] 全螢幕禪境氛圍引擎 (Zen Ambient Background Engine)
 * 職責：
 * 1. 極致沉靜無干擾的動態背景特效 (Zen Atmospheric Canvas)
 * 2. 方格各自以極低彩度緩緩呼吸變色 (Individual Cell Low-Saturation Chromatic Breathing)
 * 3. 格線微幅、平緩的流體漣漪起伏變形 (Gentle Undulating Silk-Grid Lines)
 * 4. 視角攝影機與縮放無縫同步 (Camera Pan & Zoom Coordinate Sync)
 * 5. 閒置暫停與資源自動回收機制 (Zero-overhead Lifecycle)
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WordChain = root.WordChain || {};
    root.WordChain.ZenAmbient = factory();
    Object.assign(root, root.WordChain.ZenAmbient);
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 雅緻古風低彩度色盤（秘色青、霽藍、琥珀、暮紫、碧潭）
  const ZEN_PALETTES = [
    { name: "秘色青", hue: 168, sat: 26, light: 48 },
    { name: "霽夜藍", hue: 216, sat: 28, light: 52 },
    { name: "暖琥珀", hue: 42,  sat: 32, light: 50 },
    { name: "暮山紫", hue: 275, sat: 24, light: 48 },
    { name: "碧潭春", hue: 142, sat: 22, light: 44 }
  ];

  class ZenAmbientEngine {
    constructor() {
      this.canvas = null;
      this.ctx = null;
      this.viewport = null;
      this.animId = null;
      this.running = false;
      this.breathingCells = [];
      this.maxCells = 16;
      this.time = 0;
      this.lastTimestamp = 0;
      this.boundResize = this.resize.bind(this);
    }

    init(viewportId = "cross-board-viewport", canvasId = "zen-ambient-canvas") {
      this.viewport = document.getElementById(viewportId);
      this.canvas = document.getElementById(canvasId);
      if (!this.canvas && this.viewport) {
        this.canvas = document.createElement("canvas");
        this.canvas.id = canvasId;
        this.canvas.className = "zen-ambient-canvas";
        this.viewport.insertBefore(this.canvas, this.viewport.firstChild);
      }
      if (!this.canvas) return;

      this.ctx = this.canvas.getContext("2d", { alpha: true });
      window.addEventListener("resize", this.boundResize, { passive: true });
      this.resize();
    }

    resize() {
      if (!this.canvas || !this.viewport) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = this.viewport.clientWidth || window.innerWidth;
      const h = this.viewport.clientHeight || window.innerHeight;

      if (this.canvas.width !== Math.floor(w * dpr) || this.canvas.height !== Math.floor(h * dpr)) {
        this.canvas.width = Math.floor(w * dpr);
        this.canvas.height = Math.floor(h * dpr);
      }
      this.canvas.style.width = `${w}px`;
      this.canvas.style.height = `${h}px`;
      if (this.ctx) {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);
      }
    }

    start() {
      if (this.running) return;
      if (!this.canvas) this.init();
      this.running = true;
      this.lastTimestamp = performance.now();
      this.resize();
      this.seedInitialCells();
      this.loop(this.lastTimestamp);
    }

    stop() {
      this.running = false;
      if (this.animId) {
        cancelAnimationFrame(this.animId);
        this.animId = null;
      }
      if (this.ctx && this.canvas) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }

    isActive() {
      return this.running;
    }

    seedInitialCells() {
      this.breathingCells = [];
      for (let i = 0; i < this.maxCells; i++) {
        const cell = this.createRandomCell();
        if (cell) {
          // 初始相位均勻交錯分佈，避免集體同時亮滅
          cell.age = Math.random() * cell.lifespan;
          this.breathingCells.push(cell);
        }
      }
    }

    createRandomCell() {
      if (!this.viewport) return null;
      const scale = this.viewport._zoomScale || 1.0;
      const scrollX = this.viewport.scrollLeft;
      const scrollY = this.viewport.scrollTop;
      const viewW = this.viewport.clientWidth || window.innerWidth;
      const viewH = this.viewport.clientHeight || window.innerHeight;

      const minCol = Math.floor((scrollX / scale) / 44);
      const maxCol = Math.ceil(((scrollX + viewW) / scale) / 44);
      const minRow = Math.floor((scrollY / scale) / 44);
      const maxRow = Math.ceil(((scrollY + viewH) / scale) / 44);

      if (maxCol <= minCol || maxRow <= minRow) return null;

      const col = minCol + Math.floor(Math.random() * (maxCol - minCol + 1));
      const row = minRow + Math.floor(Math.random() * (maxRow - minRow + 1));
      const palette = ZEN_PALETTES[Math.floor(Math.random() * ZEN_PALETTES.length)];

      return {
        col,
        row,
        palette,
        age: 0,
        lifespan: 8 + Math.random() * 8, // 8 ~ 16 秒超慢悠長呼吸週期
        maxAlpha: 0.035 + Math.random() * 0.03 // 極低彩度不干擾透明度 (3.5% ~ 6.5%)
      };
    }

    loop(timestamp) {
      if (!this.running) return;

      const delta = Math.min(0.1, (timestamp - this.lastTimestamp) / 1000);
      this.lastTimestamp = timestamp;
      this.time += delta;

      this.render(delta);
      this.animId = requestAnimationFrame((ts) => this.loop(ts));
    }

    render(delta) {
      if (!this.ctx || !this.viewport || !this.canvas) return;

      const w = this.viewport.clientWidth || window.innerWidth;
      const h = this.viewport.clientHeight || window.innerHeight;
      const scale = this.viewport._zoomScale || 1.0;
      const scrollX = this.viewport.scrollLeft;
      const scrollY = this.viewport.scrollTop;

      this.ctx.clearRect(0, 0, w, h);

      // ==========================================
      // 1. 深邃星雲微光極光波 (Cosmic Aurora Breath)
      // ==========================================
      const aurX1 = w * 0.3 + Math.sin(this.time * 0.12) * (w * 0.15);
      const aurY1 = h * 0.4 + Math.cos(this.time * 0.15) * (h * 0.15);
      const grad1 = this.ctx.createRadialGradient(aurX1, aurY1, 20, aurX1, aurY1, Math.max(w, h) * 0.55);
      grad1.addColorStop(0, "rgba(0, 206, 201, 0.035)");
      grad1.addColorStop(1, "rgba(0, 206, 201, 0)");
      this.ctx.fillStyle = grad1;
      this.ctx.fillRect(0, 0, w, h);

      const aurX2 = w * 0.7 + Math.cos(this.time * 0.1) * (w * 0.18);
      const aurY2 = h * 0.6 + Math.sin(this.time * 0.14) * (h * 0.18);
      const grad2 = this.ctx.createRadialGradient(aurX2, aurY2, 20, aurX2, aurY2, Math.max(w, h) * 0.5);
      grad2.addColorStop(0, "rgba(241, 196, 15, 0.025)");
      grad2.addColorStop(1, "rgba(241, 196, 15, 0)");
      this.ctx.fillStyle = grad2;
      this.ctx.fillRect(0, 0, w, h);

      // ==========================================
      // 2. 方格各自以極低彩度緩緩變色 (Individual Cell Breathing)
      // ==========================================
      const cellPitch = 44 * scale;
      const cellW = 42 * scale;

      for (let i = this.breathingCells.length - 1; i >= 0; i--) {
        const cell = this.breathingCells[i];
        cell.age += delta;

        if (cell.age >= cell.lifespan) {
          // 自然退役，置換為新座標方格
          const newCell = this.createRandomCell();
          if (newCell) {
            this.breathingCells[i] = newCell;
          } else {
            this.breathingCells.splice(i, 1);
          }
          continue;
        }

        // 柔和正弦鐘型透明度曲線 (Sinusoidal Bell Curve)
        const progress = cell.age / cell.lifespan;
        const currentAlpha = Math.sin(progress * Math.PI) * cell.maxAlpha;
        if (currentAlpha <= 0.001) continue;

        const screenX = (cell.col * 44) * scale - scrollX;
        const screenY = (cell.row * 44) * scale - scrollY;

        // 若方格超出可視範圍則略過渲染
        if (screenX + cellW < 0 || screenX > w || screenY + cellW < 0 || screenY > h) continue;

        const p = cell.palette;
        this.ctx.fillStyle = `hsla(${p.hue}, ${p.sat}%, ${p.light}%, ${currentAlpha.toFixed(4)})`;

        // 繪製圓角柔光方格
        const r = Math.max(2, 4 * scale);
        this.ctx.beginPath();
        if (this.ctx.roundRect) {
          this.ctx.roundRect(screenX, screenY, cellW, cellW, r);
        } else {
          this.ctx.rect(screenX, screenY, cellW, cellW);
        }
        this.ctx.fill();

        // 極微光外框
        this.ctx.strokeStyle = `hsla(${p.hue}, ${p.sat + 10}%, ${p.light + 10}%, ${(currentAlpha * 1.4).toFixed(4)})`;
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
      }

      // ==========================================
      // 3. 格線微幅、很慢的流體起伏變形 (Subtle Undulating Silk Grid)
      // ==========================================
      const minCol = Math.floor(scrollX / cellPitch) - 1;
      const maxCol = Math.ceil((scrollX + w) / cellPitch) + 1;
      const minRow = Math.floor(scrollY / cellPitch) - 1;
      const maxRow = Math.ceil((scrollY + h) / cellPitch) + 1;

      // 漣漪振幅與波長參數（極微幅：1.6px ~ 2.0px，完全不干擾文字閱讀）
      const waveAmp = 1.8 * Math.min(1.5, scale);
      const waveFreq = 0.0055;
      const waveSpeed = 0.26;

      this.ctx.strokeStyle = "rgba(255, 255, 255, 0.052)";
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();

      // 繪製微幅波動之垂直格線
      const stepY = 24;
      for (let col = minCol; col <= maxCol; col++) {
        const baseX = col * cellPitch - scrollX;
        if (baseX < -10 || baseX > w + 10) continue;

        for (let y = 0; y <= h + stepY; y += stepY) {
          const actualY = Math.min(h, y);
          const worldY = actualY + scrollY;
          const offsetX = Math.sin(worldY * waveFreq + this.time * waveSpeed + col * 0.28) * waveAmp;
          const px = baseX + offsetX;

          if (y === 0) {
            this.ctx.moveTo(px, actualY);
          } else {
            this.ctx.lineTo(px, actualY);
          }
        }
      }

      // 繪製微幅波動之水平格線
      const stepX = 24;
      for (let row = minRow; row <= maxRow; row++) {
        const baseY = row * cellPitch - scrollY;
        if (baseY < -10 || baseY > h + 10) continue;

        for (let x = 0; x <= w + stepX; x += stepX) {
          const actualX = Math.min(w, x);
          const worldX = actualX + scrollX;
          const offsetY = Math.cos(worldX * waveFreq + this.time * waveSpeed + row * 0.25) * waveAmp;
          const py = baseY + offsetY;

          if (x === 0) {
            this.ctx.moveTo(actualX, py);
          } else {
            this.ctx.lineTo(actualX, py);
          }
        }
      }

      this.ctx.stroke();
    }
  }

  const instance = new ZenAmbientEngine();

  return {
    ZenAmbientEngine,
    instance,
    init: (...args) => instance.init(...args),
    start: () => instance.start(),
    stop: () => instance.stop(),
    isActive: () => instance.isActive(),
    resize: () => instance.resize()
  };
});
