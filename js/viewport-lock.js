/**
 * السبورة الذكية - قفل Viewport + إيماءات اللمس الذكية
 * Smart Whiteboard - Viewport Lock & Smart Touch Gestures
 *
 * الإصلاحات:
 * ✔ Pinch بإصبعين فوق الورقة مباشرة (يُلتقط على document لا canvas-area فقط)
 * ✔ Scroll بثلاثة أصابع في أي مكان
 * ✔ إزالة الفراغات عند التصغير (wrapper-based layout في zoom.js)
 * ✔ momentum + rubber-band للـ pinch
 */

(function () {
    'use strict';

    // ═══════════════════════════════════════════════════
    // ① منع zoom المتصفح الافتراضي (pinch / gesture)
    // ═══════════════════════════════════════════════════

    // نمنع pinch-zoom المتصفح على document بالكامل
    document.addEventListener('touchmove', function (e) {
        if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });

    document.addEventListener('gesturestart',  function (e) { e.preventDefault(); }, { passive: false });
    document.addEventListener('gesturechange', function (e) { e.preventDefault(); }, { passive: false });
    document.addEventListener('gestureend',    function (e) { e.preventDefault(); }, { passive: false });

    // ═══════════════════════════════════════════════════
    // ② منع Pull-to-refresh
    // ═══════════════════════════════════════════════════

    let _pullStartY = 0;

    document.addEventListener('touchstart', function (e) {
        if (e.touches.length === 1) _pullStartY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
        if (e.touches.length !== 1) return;
        if (document.documentElement.scrollTop === 0 &&
            e.touches[0].clientY - _pullStartY > 0) {
            e.preventDefault();
        }
    }, { passive: false });

    // ═══════════════════════════════════════════════════
    // ③ Ctrl+= / Ctrl+- / Ctrl+0 — zoom لوحة المفاتيح
    // ═══════════════════════════════════════════════════

    document.addEventListener('keydown', function (e) {
        if (!e.ctrlKey && !e.metaKey) return;
        switch (e.key) {
            case '=': case '+': e.preventDefault(); if (typeof zoomIn    === 'function') zoomIn();    break;
            case '-': case '_': e.preventDefault(); if (typeof zoomOut   === 'function') zoomOut();   break;
            case '0':           e.preventDefault(); if (typeof resetZoom === 'function') resetZoom(); break;
        }
    });

    // ═══════════════════════════════════════════════════
    // ④ Ctrl + Wheel — zoom حول المؤشر
    // ═══════════════════════════════════════════════════

    document.addEventListener('wheel', function (e) {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        if (typeof zoomAroundPoint === 'function') zoomAroundPoint(factor, e.clientX, e.clientY);
    }, { passive: false });

    // ═══════════════════════════════════════════════════
    // الكود التالي يعمل بعد تحميل الصفحة
    // ═══════════════════════════════════════════════════

    window.addEventListener('load', function () {
        const area = document.querySelector('.canvas-area');
        if (!area) return;

        area.style.overflowX          = 'auto';
        area.style.overflowY          = 'auto';
        area.style.overscrollBehavior = 'none';

        // ─────────────────────────────────────────────
        // ⑤ Pan بالماوس (زر أوسط أو أداة اليد)
        // ─────────────────────────────────────────────

        let _mp = false, _mx = 0, _my = 0, _sx = 0, _sy = 0;

        area.addEventListener('mousedown', function (e) {
            const isPan = typeof currentTool !== 'undefined' && currentTool === 'pan';
            if (!isPan && e.button !== 1) return;
            e.preventDefault();
            _mp = true;
            _mx = e.clientX; _my = e.clientY;
            _sx = area.scrollLeft; _sy = area.scrollTop;
            area.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', function (e) {
            if (!_mp) return;
            area.scrollLeft = _sx - (e.clientX - _mx);
            area.scrollTop  = _sy - (e.clientY - _my);
        });

        window.addEventListener('mouseup', function () {
            if (!_mp) return;
            _mp = false;
            area.style.cursor = '';
        });

        // ─────────────────────────────────────────────
        // ⑥ إيماءات اللمس — منطق موحّد على document
        //    • إصبع واحد  + أداة Pan  → scroll
        //    • إصبعان                  → Pinch Zoom
        //    • ثلاثة أصابع             → Scroll عمودي/أفقي
        // ─────────────────────────────────────────────

        // حالة الـ pan باللمس
        let _tp = false, _tx = 0, _ty = 0, _tsx = 0, _tsy = 0;

        // حالة الـ pinch
        let _pinchActive  = false;
        let _pinchDist    = 0;
        let _pinchBaseScale = 1;
        let _pinchCX      = 0, _pinchCY = 0;

        // momentum للـ pinch
        let _velScale     = 1;
        let _lastPinchT   = 0;
        let _rafId        = null;

        // حالة الـ 3-finger scroll
        let _threeActive  = false;
        let _thrX = 0, _thrY = 0, _thrSX = 0, _thrSY = 0;

        function _stopMomentum() {
            if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
            _velScale = 1;
        }

        function _runMomentum() {
            const delta = _velScale - 1;
            if (Math.abs(delta) < 0.0008) { _velScale = 1; return; }
            if (typeof zoomAroundPoint === 'function') {
                zoomAroundPoint(1 + delta * 0.8, _pinchCX, _pinchCY);
            }
            _velScale = 1 + delta * 0.82;
            _rafId = requestAnimationFrame(_runMomentum);
        }

        // ── touchstart ──
        document.addEventListener('touchstart', function (e) {
            const n = e.touches.length;

            // ثلاثة أصابع — scroll
            if (n === 3) {
                e.preventDefault();
                _stopMomentum();
                _pinchActive = false;
                _tp          = false;
                _threeActive = true;
                const cx = (e.touches[0].clientX + e.touches[1].clientX + e.touches[2].clientX) / 3;
                const cy = (e.touches[0].clientY + e.touches[1].clientY + e.touches[2].clientY) / 3;
                _thrX  = cx; _thrY  = cy;
                _thrSX = area.scrollLeft;
                _thrSY = area.scrollTop;
                return;
            }

            // إصبعان — Pinch Zoom (يُفعَّل في أي مكان فوق الصفحة)
            if (n === 2) {
                e.preventDefault();
                _stopMomentum();
                _tp          = false;
                _threeActive = false;
                _pinchActive = true;

                const t1 = e.touches[0], t2 = e.touches[1];
                _pinchDist      = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                _pinchBaseScale = (typeof globalScale !== 'undefined') ? globalScale : 1;
                _pinchCX        = (t1.clientX + t2.clientX) / 2;
                _pinchCY        = (t1.clientY + t2.clientY) / 2;
                _lastPinchT     = e.timeStamp;
                return;
            }

            // إصبع واحد — Pan (أداة اليد فقط)
            if (n === 1) {
                _pinchActive = false;
                _threeActive = false;
                const isPan = typeof currentTool !== 'undefined' && currentTool === 'pan';
                if (!isPan) return;
                // تحقق أن اللمسة فوق canvas-area
                const target = e.touches[0].target;
                if (!area.contains(target)) return;
                e.preventDefault();
                _tp  = true;
                _tx  = e.touches[0].clientX; _ty  = e.touches[0].clientY;
                _tsx = area.scrollLeft;       _tsy = area.scrollTop;
            }
        }, { passive: false });

        // ── touchmove ──
        document.addEventListener('touchmove', function (e) {
            const n = e.touches.length;

            // ثلاثة أصابع — scroll
            if (n === 3 && _threeActive) {
                e.preventDefault();
                const cx = (e.touches[0].clientX + e.touches[1].clientX + e.touches[2].clientX) / 3;
                const cy = (e.touches[0].clientY + e.touches[1].clientY + e.touches[2].clientY) / 3;
                area.scrollLeft = _thrSX - (cx - _thrX);
                area.scrollTop  = _thrSY - (cy - _thrY);
                return;
            }

            // إصبعان — Pinch Zoom
            if (n === 2 && _pinchActive) {
                e.preventDefault();

                const t1   = e.touches[0], t2 = e.touches[1];
                const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                const cx   = (t1.clientX + t2.clientX) / 2;
                const cy   = (t1.clientY + t2.clientY) / 2;

                if (_pinchDist === 0) return;

                const rawFactor   = dist / _pinchDist;
                const minS = typeof MIN_SCALE !== 'undefined' ? MIN_SCALE : 0.2;
                const maxS = typeof MAX_SCALE !== 'undefined' ? MAX_SCALE : 5;
                const targetScale = _pinchBaseScale * rawFactor;

                // rubber-band عند الحدود
                let newScale;
                if (targetScale < minS) {
                    newScale = minS * Math.pow(targetScale / minS, 0.4);
                } else if (targetScale > maxS) {
                    newScale = maxS * Math.pow(targetScale / maxS, 0.4);
                } else {
                    newScale = targetScale;
                }

                // velocity للـ momentum
                const dt = e.timeStamp - _lastPinchT;
                if (dt > 0 && typeof globalScale !== 'undefined') {
                    const instFactor = newScale / globalScale;
                    _velScale = 1 + (instFactor - 1) * Math.min(1, 16 / dt);
                }
                _lastPinchT = e.timeStamp;

                if (typeof zoomAroundPoint === 'function') {
                    // احسب factor من الـ scale الحالي
                    const curScale = typeof globalScale !== 'undefined' ? globalScale : 1;
                    const factor   = Math.max(minS, Math.min(newScale, maxS)) / curScale;
                    zoomAroundPoint(factor, cx, cy);
                }

                _pinchCX = cx;
                _pinchCY = cy;
                return;
            }

            // إصبع واحد — Pan
            if (n === 1 && _tp) {
                e.preventDefault();
                area.scrollLeft = _tsx - (e.touches[0].clientX - _tx);
                area.scrollTop  = _tsy - (e.touches[0].clientY - _ty);
            }
        }, { passive: false });

        // ── touchend / touchcancel ──
        document.addEventListener('touchend', function (e) {
            const remaining = e.touches.length;

            if (_threeActive && remaining < 3) {
                _threeActive = false;
            }

            if (_pinchActive && remaining < 2) {
                _pinchActive = false;
                // أطلق momentum إذا كان هناك سرعة
                if (Math.abs(_velScale - 1) > 0.004) {
                    _rafId = requestAnimationFrame(_runMomentum);
                }
            }

            if (_tp && remaining === 0) {
                _tp = false;
            }
        }, { passive: true });

        document.addEventListener('touchcancel', function () {
            _tp          = false;
            _pinchActive = false;
            _threeActive = false;
            _stopMomentum();
        }, { passive: true });

        console.log('viewport-lock v3: جاهز (Pinch فوق الورقة + 3-finger scroll)');
    });

})();
