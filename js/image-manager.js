/**
 * السبورة الذكية - إدارة الصور
 * Smart Whiteboard - Image Manager
 * 
 * الميزات:
 * - إدراج صورة من الجهاز (file upload)
 * - لصق صورة من الحافظة  (Ctrl+V / paste)
 * - سحب وإفلات صورة      (drag & drop)
 * - تحريك الصورة          (drag to move)
 * - تغيير الحجم           (resize handles)
 * - حذف الصورة            (Delete key / delete button)
 * - دمج الصورة في اللوحة  (flatten to canvas on deselect / tool change)
 */

// -------------------- حالة الصور (Image State) --------------------

// كل صفحة لديها مصفوفة صور مستقلة
// pageData.images = [ { img, x, y, w, h, id }, ... ]
// activeImage = { pageIndex, imageIndex, handle }  ← الصورة المحددة حالياً

let activeImage = null;          // الصورة المحددة
let imgDragState = null;         // حالة السحب
let imgResizeState = null;       // حالة تغيير الحجم

const HANDLE_SIZE = 10;          // حجم مقابض تغيير الحجم (px)
const MIN_IMG_SIZE = 30;         // الحد الأدنى للحجم

// -------------------- الطبقة العلوية للصور (Image Overlay Layer) --------------------
// نستخدم canvas ثانٍ يُرسم فوق canvas الرئيسي لعرض الصور والمقابض
// بدلاً من دمجها داخل canvas الرئيسي مباشرةً (يُتيح التحريك/الريسايز)

/**
 * إنشاء أو استرجاع imageCanvas الخاص بالصفحة
 */
function getImageLayer(page) {
    if (page.imageCanvas) return page.imageCanvas;

    const overlay = document.createElement('canvas');
    overlay.width  = page.canvas.width;
    overlay.height = page.canvas.height;
    overlay.className = 'image-overlay-canvas';
    overlay.style.cssText = `
        position: absolute;
        top: 0; left: 0;
        pointer-events: none;
        z-index: 5;
    `;
    page.element.appendChild(overlay);
    page.imageCanvas    = overlay;
    page.imageCtx       = overlay.getContext('2d');
    page.images         = page.images || [];
    return overlay;
}

/**
 * إعادة رسم طبقة الصور لصفحة معينة
 */
function redrawImageLayer(pageIndex) {
    const page = pages[pageIndex];
    if (!page) return;
    getImageLayer(page);
    const ctx = page.imageCtx;
    ctx.clearRect(0, 0, page.imageCanvas.width, page.imageCanvas.height);

    (page.images || []).forEach((imgObj, idx) => {
        ctx.drawImage(imgObj.img, imgObj.x, imgObj.y, imgObj.w, imgObj.h);

        // رسم إطار التحديد والمقابض إذا كانت هذه الصورة محددة
        if (activeImage && activeImage.pageIndex === pageIndex && activeImage.imageIndex === idx) {
            drawSelectionHandles(ctx, imgObj);
        }
    });
}

/**
 * رسم إطار التحديد ومقابض تغيير الحجم
 */
function drawSelectionHandles(ctx, imgObj) {
    const { x, y, w, h } = imgObj;
    const hs = HANDLE_SIZE;

    // إطار التحديد
    ctx.save();
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    // مقابض الزوايا والأوساط (8 مقابض)
    const handles = getHandleRects(imgObj);
    handles.forEach(hr => {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(hr.x, hr.y, hs, hs);
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(hr.x, hr.y, hs, hs);
    });

    // زر الحذف (X أحمر) في الزاوية العلوية اليسرى
    ctx.fillStyle   = '#EF4444';
    ctx.beginPath();
    ctx.arc(x + w - 6, y - 6, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✕', x + w - 6, y - 6);

    ctx.restore();
}

/**
 * حساب مستطيلات المقابض الـ8
 * الترتيب: TL, TC, TR, ML, MR, BL, BC, BR
 */
function getHandleRects(imgObj) {
    const { x, y, w, h } = imgObj;
    const hs = HANDLE_SIZE;
    const half = hs / 2;
    return [
        { id: 'TL', x: x - half,       y: y - half       },
        { id: 'TC', x: x + w/2 - half, y: y - half       },
        { id: 'TR', x: x + w - half,   y: y - half       },
        { id: 'ML', x: x - half,       y: y + h/2 - half },
        { id: 'MR', x: x + w - half,   y: y + h/2 - half },
        { id: 'BL', x: x - half,       y: y + h - half   },
        { id: 'BC', x: x + w/2 - half, y: y + h - half   },
        { id: 'BR', x: x + w - half,   y: y + h - half   },
    ];
}

/**
 * الحصول على المقبض الذي يقع عليه الماوس
 */
function getHitHandle(imgObj, mx, my) {
    const hs = HANDLE_SIZE;
    for (const hr of getHandleRects(imgObj)) {
        if (mx >= hr.x && mx <= hr.x + hs && my >= hr.y && my <= hr.y + hs) {
            return hr.id;
        }
    }
    return null;
}

/**
 * التحقق إذا كان الماوس داخل صورة
 */
function hitTestImage(imgObj, mx, my) {
    return mx >= imgObj.x && mx <= imgObj.x + imgObj.w &&
           my >= imgObj.y && my <= imgObj.y + imgObj.h;
}

/**
 * التحقق إذا الماوس على زر الحذف
 */
function hitTestDeleteBtn(imgObj, mx, my) {
    const bx = imgObj.x + imgObj.w - 6;
    const by = imgObj.y - 6;
    return Math.hypot(mx - bx, my - by) <= 10;
}

// -------------------- إضافة صورة (Add Image) --------------------

/**
 * إضافة صورة إلى الصفحة الحالية
 * @param {HTMLImageElement|string} source - img element أو data URL
 */
function addImageToPage(source, pageIndex) {
    const page = pages[pageIndex];
    if (!page) return;
    getImageLayer(page);

    const doAdd = (img) => {
        // أقصى أبعاد أولية: ثلث عرض اللوحة
        const maxW = page.canvas.width  * 0.5;
        const maxH = page.canvas.height * 0.5;
        let w = img.naturalWidth  || img.width  || 200;
        let h = img.naturalHeight || img.height || 200;

        if (w > maxW) { const r = maxW / w; w = maxW; h = h * r; }
        if (h > maxH) { const r = maxH / h; h = maxH; w = w * r; }

        // وضع الصورة في المنتصف
        const x = (page.canvas.width  - w) / 2;
        const y = (page.canvas.height - h) / 2;

        const imgObj = { img, x, y, w, h, id: Date.now() };
        page.images.push(imgObj);

        // تحديد الصورة الجديدة فوراً
        activeImage = { pageIndex, imageIndex: page.images.length - 1 };

        // تفعيل طبقة الصور للتفاعل
        enableImageLayerEvents(page, pageIndex);

        redrawImageLayer(pageIndex);
        console.log('تمت إضافة صورة إلى الصفحة', pageIndex + 1);
    };

    if (typeof source === 'string') {
        const img = new Image();
        img.onload = () => doAdd(img);
        img.src = source;
    } else if (source instanceof HTMLImageElement) {
        if (source.complete) doAdd(source);
        else source.onload = () => doAdd(source);
    }
}

// -------------------- أحداث الطبقة التفاعلية (Image Layer Events) --------------------

const _listenedPages = new Set(); // لتجنب تكرار إضافة المستمعين

function enableImageLayerEvents(page, pageIndex) {
    if (_listenedPages.has(pageIndex)) return;
    _listenedPages.add(pageIndex);

    // نستخدم canvas الرئيسي للأحداث لأنه هو من يستقبل الأحداث فعلياً
    // لكن نحتاج طبقة شفافة فوقه تستقبل الأحداث فقط عند وضع أداة الصورة
    const imgCanvas = page.imageCanvas;
    imgCanvas.style.pointerEvents = 'auto'; // تفعيل الأحداث على الطبقة

    imgCanvas.addEventListener('mousedown', (e) => onImgMouseDown(e, pageIndex));
    imgCanvas.addEventListener('mousemove', (e) => onImgMouseMove(e, pageIndex));
    imgCanvas.addEventListener('mouseup',   (e) => onImgMouseUp(e, pageIndex));
    imgCanvas.addEventListener('mouseleave',()  => onImgMouseLeave(pageIndex));
    imgCanvas.addEventListener('dblclick',  (e) => onImgDblClick(e, pageIndex));
}

function getCanvasPosFromEvent(e, page) {
    const rect = page.imageCanvas.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left) / page.scale,
        y: (e.clientY - rect.top)  / page.scale
    };
}

function onImgMouseDown(e, pageIndex) {
    // فقط في وضع أداة الصور
    if (currentTool !== 'image-select') return;

    const page = pages[pageIndex];
    const pos  = getCanvasPosFromEvent(e, page);

    // البحث عن صورة تحت الماوس (من الأحدث للأقدم)
    const imgs = page.images || [];
    for (let i = imgs.length - 1; i >= 0; i--) {
        const imgObj = imgs[i];

        // هل على زر الحذف؟
        if (activeImage && activeImage.imageIndex === i && hitTestDeleteBtn(imgObj, pos.x, pos.y)) {
            deleteActiveImage();
            return;
        }

        // هل على مقبض تغيير الحجم؟
        if (activeImage && activeImage.imageIndex === i) {
            const handle = getHitHandle(imgObj, pos.x, pos.y);
            if (handle) {
                imgResizeState = {
                    handle,
                    startX: pos.x, startY: pos.y,
                    origX: imgObj.x, origY: imgObj.y,
                    origW: imgObj.w, origH: imgObj.h,
                    aspectRatio: imgObj.w / imgObj.h
                };
                e.stopPropagation();
                return;
            }
        }

        // هل داخل الصورة؟
        if (hitTestImage(imgObj, pos.x, pos.y)) {
            activeImage = { pageIndex, imageIndex: i };
            imgDragState = {
                startX: pos.x, startY: pos.y,
                origX: imgObj.x, origY: imgObj.y
            };
            redrawImageLayer(pageIndex);
            e.stopPropagation();
            return;
        }
    }

    // النقر في فراغ → إلغاء التحديد وإدماج الصور في اللوحة
    if (activeImage && activeImage.pageIndex === pageIndex) {
        flattenImagesToCanvas(pageIndex);
    }
}

function onImgMouseMove(e, pageIndex) {
    if (currentTool !== 'image-select') return;
    const page = pages[pageIndex];
    const pos  = getCanvasPosFromEvent(e, page);
    const imgs = page.images || [];

    // تغيير شكل الماوس
    updateImageCursor(page, pageIndex, pos, e);

    // --- سحب (Move) ---
    if (imgDragState && activeImage && activeImage.pageIndex === pageIndex) {
        const imgObj = imgs[activeImage.imageIndex];
        if (!imgObj) return;
        imgObj.x = imgDragState.origX + (pos.x - imgDragState.startX);
        imgObj.y = imgDragState.origY + (pos.y - imgDragState.startY);
        redrawImageLayer(pageIndex);
        return;
    }

    // --- تغيير الحجم (Resize) ---
    if (imgResizeState && activeImage && activeImage.pageIndex === pageIndex) {
        const imgObj = imgs[activeImage.imageIndex];
        if (!imgObj) return;
        resizeImage(imgObj, imgResizeState, pos);
        redrawImageLayer(pageIndex);
    }
}

function onImgMouseUp(e, pageIndex) {
    if (imgDragState || imgResizeState) {
        saveToHistory(pageIndex); // حفظ في السجل بعد الحركة/تغيير الحجم
    }
    imgDragState   = null;
    imgResizeState = null;
}

function onImgMouseLeave(pageIndex) {
    if (imgDragState || imgResizeState) {
        saveToHistory(pageIndex);
    }
    imgDragState   = null;
    imgResizeState = null;
}

function onImgDblClick(e, pageIndex) {
    // دبل كليك على الصورة → إدماج في اللوحة
    if (currentTool !== 'image-select') return;
    const page = pages[pageIndex];
    const pos  = getCanvasPosFromEvent(e, page);
    const imgs = page.images || [];

    for (let i = imgs.length - 1; i >= 0; i--) {
        if (hitTestImage(imgs[i], pos.x, pos.y)) {
            flattenImagesToCanvas(pageIndex);
            return;
        }
    }
}

/**
 * تغيير شكل مؤشر الماوس حسب موقعه
 */
function updateImageCursor(page, pageIndex, pos, e) {
    const imgs = page.images || [];
    const canvas = page.imageCanvas;

    if (activeImage && activeImage.pageIndex === pageIndex) {
        const imgObj = imgs[activeImage.imageIndex];
        if (imgObj) {
            if (hitTestDeleteBtn(imgObj, pos.x, pos.y)) { canvas.style.cursor = 'pointer'; return; }
            const h = getHitHandle(imgObj, pos.x, pos.y);
            if (h) {
                const cursors = { TL:'nwse-resize', TR:'nesw-resize', BL:'nesw-resize', BR:'nwse-resize',
                                  TC:'ns-resize',   BC:'ns-resize',   ML:'ew-resize',   MR:'ew-resize' };
                canvas.style.cursor = cursors[h] || 'crosshair'; return;
            }
            if (hitTestImage(imgObj, pos.x, pos.y)) { canvas.style.cursor = 'move'; return; }
        }
    }

    // البحث عن أي صورة
    for (let i = imgs.length - 1; i >= 0; i--) {
        if (hitTestImage(imgs[i], pos.x, pos.y)) { canvas.style.cursor = 'move'; return; }
    }
    canvas.style.cursor = 'default';
}

/**
 * حساب أبعاد الصورة الجديدة عند السحب بمقبض
 */
function resizeImage(imgObj, state, pos) {
    const dx = pos.x - state.startX;
    const dy = pos.y - state.startY;
    const h  = state.handle;

    let newX = state.origX, newY = state.origY;
    let newW = state.origW, newH = state.origH;

    // حساب الأبعاد بناءً على المقبض
    if (h.includes('R')) newW = Math.max(MIN_IMG_SIZE, state.origW + dx);
    if (h.includes('L')) { newW = Math.max(MIN_IMG_SIZE, state.origW - dx); newX = state.origX + (state.origW - newW); }
    if (h.includes('B')) newH = Math.max(MIN_IMG_SIZE, state.origH + dy);
    if (h.includes('T')) { newH = Math.max(MIN_IMG_SIZE, state.origH - dy); newY = state.origY + (state.origH - newH); }

    // الحفاظ على النسبة عند سحب الزوايا + Shift
    // (مفعّل دائماً للزوايا الأربع لتسهيل الاستخدام)
    if ((h === 'TL' || h === 'TR' || h === 'BL' || h === 'BR')) {
        // نسبة العرض/الارتفاع الأصلية
        const ar = state.aspectRatio;
        if (Math.abs(dx) > Math.abs(dy)) {
            newH = newW / ar;
            if (h.includes('T')) newY = state.origY + (state.origH - newH);
        } else {
            newW = newH * ar;
            if (h.includes('L')) newX = state.origX + (state.origW - newW);
        }
    }

    imgObj.x = newX; imgObj.y = newY;
    imgObj.w = newW; imgObj.h = newH;
}

// -------------------- حذف الصورة المحددة (Delete Active Image) --------------------

function deleteActiveImage() {
    if (!activeImage) return;
    const page = pages[activeImage.pageIndex];
    if (!page || !page.images) return;
    page.images.splice(activeImage.imageIndex, 1);
    activeImage = null;
    redrawImageLayer(activeImage ? activeImage.pageIndex : currentPage);
    saveToHistory(currentPage);
}

// -------------------- دمج الصور في اللوحة الرئيسية (Flatten) --------------------

/**
 * رسم جميع الصور الحالية على canvas الرئيسي ثم مسحها من الطبقة
 * يُستدعى عند:
 *  - النقر في فراغ بأداة الصورة
 *  - تغيير الأداة
 *  - قبل حفظ PDF
 */
function flattenImagesToCanvas(pageIndex) {
    const page = pages[pageIndex];
    if (!page || !page.images || page.images.length === 0) {
        activeImage = null;
        if (page && page.imageCtx) page.imageCtx.clearRect(0, 0, page.imageCanvas.width, page.imageCanvas.height);
        return;
    }

    page.images.forEach(imgObj => {
        page.ctx.globalAlpha = 1.0;
        page.ctx.globalCompositeOperation = 'source-over';
        page.ctx.drawImage(imgObj.img, imgObj.x, imgObj.y, imgObj.w, imgObj.h);
    });

    page.images = [];
    activeImage  = null;

    if (page.imageCtx) {
        page.imageCtx.clearRect(0, 0, page.imageCanvas.width, page.imageCanvas.height);
    }

    saveToHistory(pageIndex);
    console.log('تم دمج الصور في اللوحة');
}

/**
 * دمج صور جميع الصفحات قبل التصدير
 */
function flattenAllPagesBeforeExport() {
    pages.forEach((_, i) => flattenImagesToCanvas(i));
}

// -------------------- رفع صورة من الجهاز (File Upload) --------------------

function setupImageUpload() {
    const fileInput = document.getElementById('image-file-input');
    if (!fileInput) return;

    fileInput.addEventListener('change', function () {
        const file = this.files[0];
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            addImageToPage(ev.target.result, currentPage);
            setActiveTool('image-select');
        };
        reader.readAsDataURL(file);
        this.value = ''; // إعادة تعيين لإتاحة رفع نفس الملف مرة أخرى
    });

    // زر أداة الصورة في شريط الأدوات
    const imageBtn = document.getElementById('image-btn');
    if (imageBtn) {
        imageBtn.addEventListener('click', () => {
            fileInput.click();
        });
    }
}

// -------------------- لصق من الحافظة (Clipboard Paste) --------------------

function setupClipboardPaste() {
    document.addEventListener('paste', (e) => {
        const items = e.clipboardData && e.clipboardData.items;
        if (!items) return;
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const blob = item.getAsFile();
                const reader = new FileReader();
                reader.onload = (ev) => {
                    addImageToPage(ev.target.result, currentPage);
                    setActiveTool('image-select');
                };
                reader.readAsDataURL(blob);
                break;
            }
        }
    });
}

// -------------------- سحب وإفلات (Drag & Drop) --------------------

function setupDragAndDrop() {
    // القبول على منطقة العمل الكاملة
    const workArea = document.querySelector('.canvas-area') || document.body;

    workArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        workArea.classList.add('drag-over');
    });

    workArea.addEventListener('dragleave', () => {
        workArea.classList.remove('drag-over');
    });

    workArea.addEventListener('drop', (e) => {
        e.preventDefault();
        workArea.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            for (const file of files) {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        addImageToPage(ev.target.result, currentPage);
                        setActiveTool('image-select');
                    };
                    reader.readAsDataURL(file);
                    break; // صورة واحدة في المرة
                }
            }
            return;
        }

        // صورة مُسحوبة من متصفح (URL)
        const imgUrl = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
        if (imgUrl && /\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i.test(imgUrl)) {
            addImageToPage(imgUrl, currentPage);
            setActiveTool('image-select');
        }
    });
}

// -------------------- اختصار لوحة المفاتيح للحذف (Delete Key) --------------------

function setupImageKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
        if (!activeImage) return;

        if (e.key === 'Delete' || e.key === 'Backspace') {
            // تجنب الحذف إذا كان المستخدم يكتب في input
            if (document.activeElement.tagName === 'INPUT' ||
                document.activeElement.tagName === 'TEXTAREA') return;
            e.preventDefault();
            deleteActiveImage();
        }

        // Escape → إلغاء التحديد وإدماج
        if (e.key === 'Escape' && activeImage) {
            flattenImagesToCanvas(activeImage.pageIndex);
        }
    });
}

// -------------------- تغيير الأداة → إدماج الصور (Tool Change Hook) --------------------

/**
 * يُستدعى من tools.js عند تغيير الأداة
 * إذا كانت هناك صور معلقة وتغيرت الأداة → ندمجها
 */
function onToolChange(newTool) {
    if (newTool !== 'image-select' && activeImage !== null) {
        flattenImagesToCanvas(activeImage.pageIndex);
    }
    // تفعيل/تعطيل طبقة الصور
    pages.forEach((page, i) => {
        if (page.imageCanvas) {
            page.imageCanvas.style.pointerEvents = (newTool === 'image-select') ? 'auto' : 'none';
        }
    });
}

// -------------------- التهيئة الرئيسية (Init) --------------------

function initImageManager() {
    setupImageUpload();
    setupClipboardPaste();
    setupDragAndDrop();
    setupImageKeyboardShortcuts();
    console.log('تم تهيئة مدير الصور');
}
