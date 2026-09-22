/**
 * 字戀 (WordChain) - [第五章] 攝影鏡頭與光學縮放引擎 (Camera Pan & Zoom Engine)
 * 職責：
 * 1. 視窗攝影機拖曳攀移 (Camera Pan - 1:1 實體跟手感、支援滑鼠左/中鍵與觸控)
 * 2. 光學變焦引擎 (Google Maps 風格游標焦點縮放、4K 自適應 400% 上限與 1.5x 預設)
 * 3. 視圖自動回正與居中 (雙擊回正、視窗變更自動置中)
 * 4. 浮動面板自由拖曳控制器 (makeDraggable，支援本機記憶位置)
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WordChain = root.WordChain || {};
    root.WordChain.Viewport = factory();
    Object.assign(root, root.WordChain.Viewport);
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function is4KDisplay() {
    if (typeof window === 'undefined') return false;
    return (window.innerWidth >= 2000 || window.innerHeight >= 1200);
  }

  function getMaxZoom() {
    return is4KDisplay() ? 4.0 : 3.0;
  }

  function getDefaultScale() {
    return is4KDisplay() ? 1.5 : 1.0;
  }

  function updateZoomHUD(viewport) {
    if (!viewport) return;
    const isDemo = viewport.id && viewport.id.includes("demo");
    const valEl = document.getElementById(isDemo ? "zoom-val-demo" : "zoom-val-battle");
    if (valEl) {
      const scale = viewport._zoomScale || 1.0;
      valEl.innerText = `${Math.round(scale * 100)}%`;
    }
  }

  function setupViewportPan(viewport, engine = null) {
    if (!viewport || viewport._panInitialized) return;
    viewport._panInitialized = true;

    const initialScale = getDefaultScale();
    viewport._zoomScale = initialScale;
    const initialGrid = viewport.querySelector(".cross-board-grid");
    if (initialGrid && initialScale !== 1.0) {
      initialGrid.style.transform = `scale(${initialScale})`;
      initialGrid.style.transformOrigin = "0 0";
    }
    updateZoomHUD(viewport);

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
      const maxScale = getMaxZoom();
      const newScale = Math.min(maxScale, Math.max(0.35, parseFloat((oldScale * factor).toFixed(2))));
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

      updateZoomHUD(viewport);

      viewport.classList.remove("is-zooming-in", "is-zooming-out");
      viewport.classList.add(e.deltaY < 0 ? "is-zooming-in" : "is-zooming-out");
      clearTimeout(viewport._zoomTimer);
      viewport._zoomTimer = setTimeout(() => {
        viewport.classList.remove("is-zooming-in", "is-zooming-out");
      }, 450);
    }, { passive: false });

    // Ctrl 鍵按住時提示放大鏡游標
    window.addEventListener("keydown", (e) => {
      if (e.key === "Control") viewport.classList.add("ctrl-zoom");
    });
    window.addEventListener("keyup", (e) => {
      if (e.key === "Control") viewport.classList.remove("ctrl-zoom");
    });

    // 雙擊畫布重設縮放或置中居中 (Double-click Reset)
    viewport.addEventListener("dblclick", (e) => {
      if (e.target === viewport || e.target.classList.contains("cross-board-grid")) {
        recenterViewport(viewport, engine, viewport.id.includes("demo"), true);
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

  function zoomViewport(viewport, delta) {
    if (!viewport) return;
    const grid = viewport.querySelector(".cross-board-grid");
    if (!grid) return;
    const oldScale = viewport._zoomScale || 1.0;
    const maxScale = getMaxZoom();
    const newScale = Math.min(maxScale, Math.max(0.35, parseFloat((oldScale + delta).toFixed(2))));
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
    updateZoomHUD(viewport);
  }

  function recenterViewport(viewport, engine = null, isDemo = false, resetScale = true) {
    if (!viewport) return;
    const grid = viewport.querySelector(".cross-board-grid");
    const defaultScale = getDefaultScale();
    if (resetScale && grid) {
      viewport._zoomScale = defaultScale;
      grid.style.transform = `scale(${defaultScale})`;
      grid.style.transformOrigin = "0 0";
      updateZoomHUD(viewport);
    }
    const app = engine || (typeof window !== 'undefined' ? window.wordChainApp : null);
    if (!app) return;

    const lastCoord = isDemo ? app.demoLastTailCoord : app.lastTailCoord;
    const rounds = isDemo ? app.demoRound : app.roundCount;
    if (lastCoord) {
      const scale = viewport._zoomScale || 1.0;
      const targetX = (lastCoord.col * 44 + 22) * scale;
      const targetY = (lastCoord.row * 44 + 22) * scale;
      const topOffset = (rounds <= 1) ? (viewport.clientHeight / 3) : (viewport.clientHeight / 2);
      viewport.scrollTo({
        left: Math.max(0, targetX - viewport.clientWidth / 2),
        top: Math.max(0, targetY - topOffset),
        behavior: "smooth"
      });
    }
  }

  function makeDraggable(el, storageKey, handleSelector = null) {
    if (!el || el._dragInitialized) return;
    el._dragInitialized = true;

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

  return {
    is4KDisplay,
    getMaxZoom,
    getDefaultScale,
    updateZoomHUD,
    setupViewportPan,
    zoomViewport,
    recenterViewport,
    makeDraggable
  };
});
