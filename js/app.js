/**
 * السبورة الذكية - التهيئة الرئيسية
 * Smart Whiteboard - App Initialization & Event Listeners
 */

// -------------------- تهيئة التطبيق (App Initialization) --------------------

function initApp() {
    createNewPage();
    setupEventListeners();

    if (penBtn) {
        setActiveToolButton(penBtn);
    } else {
        console.error("Pen button not found. Cannot set default active tool button.");
    }

    setCanvasCursor(currentTool);

    if (bgTypeSelect) {
        setBgPatternForAllPages(bgTypeSelect.value);
    } else {
        console.error("Background type select not found.");
    }

    updateZoomPercentageDisplay();
    updateUndoRedoButtons();
    initImageManager();
    console.log("تم تهيئة التطبيق بنجاح!");
}

// -------------------- تسجيل الأحداث العامة (Global Event Listeners) --------------------

function setupEventListeners() {

    // --- أدوات الرسم (Drawing Tools) ---
    if (penBtn)       penBtn.addEventListener("click",       () => setActiveTool("pen"));
    if (highlightBtn) highlightBtn.addEventListener("click", () => setActiveTool("highlight"));
    if (eraserBtn)    eraserBtn.addEventListener("click",    () => setActiveTool("eraser"));
    if (panBtn)       panBtn.addEventListener("click",       () => setActiveTool("pan"));

    // --- أدوات الأشكال (Shape Tools) ---
    if (rectBtn)   rectBtn.addEventListener("click",   () => setActiveTool("rect"));
    if (circleBtn) circleBtn.addEventListener("click", () => setActiveTool("circle"));
    if (lineBtn)   lineBtn.addEventListener("click",   () => setActiveTool("line"));
    if (arrowBtn)  arrowBtn.addEventListener("click",  () => setActiveTool("arrow"));

    if (tableBtn) {
        tableBtn.addEventListener("click", () => {
            setActiveTool("table");
            if (tableOptionsDiv) tableOptionsDiv.classList.remove('hidden');
        });
    }

    // --- أزرار الرأس (Header Buttons) ---
    if (clearBtn)        clearBtn.addEventListener("click",        clearCanvas);
    if (undoBtn)         undoBtn.addEventListener("click",         undo);
    if (redoBtn)         redoBtn.addEventListener("click",         redo);
    if (darkModeBtn)     darkModeBtn.addEventListener("click",     toggleDarkMode);
    if (settingsBtn)     settingsBtn.addEventListener("click",     toggleSettingsPanel);
    if (toggleSidebarBtn)toggleSidebarBtn.addEventListener("click",toggleSidebar);

    // --- التكبير/التصغير (Zoom) ---
    if (zoomInBtn)  zoomInBtn.addEventListener("click",  zoomIn);
    if (zoomOutBtn) zoomOutBtn.addEventListener("click", zoomOut);

    // --- إدارة الصفحات (Page Management) ---
    if (addPageBtn) addPageBtn.addEventListener("click", createNewPage);

    // --- لوحة الإعدادات (Settings Panel) ---
    if (bgTypeSelect) bgTypeSelect.addEventListener("change", () => setBgPatternForAllPages(bgTypeSelect.value));
    if (savePdfBtn)   savePdfBtn.addEventListener("click",   saveAsPdf);

    // --- اختصارات لوحة المفاتيح (Keyboard Shortcuts) ---
    window.addEventListener("keydown", handleKeyShortcuts);

    // --- اختيار اللون (Color Selection) ---
    document.querySelectorAll(".color-circle").forEach(circle => {
        circle.addEventListener("click", function () {
            if (this.classList.contains("custom-color-btn")) {
                if (colorPicker) colorPicker.click();
                else console.error("Color picker element not found.");
            } else {
                setCurrentColor(this.dataset.color);
                updateColorUI(this.dataset.color);
            }
        });
    });

    if (colorPicker) {
        colorPicker.addEventListener("input", function () {
            setCurrentColor(this.value);
            updateColorUI(this.value);
        });
    }

    // --- اختيار الحجم (Size Selection) ---
    if (sizeSlider && sizeValue) {
        sizeSlider.addEventListener("input", function () {
            const size = parseInt(this.value);
            setCurrentSize(size);
            sizeValue.textContent = size + "px";
            updateSizeUI(size);
        });
    }

    document.querySelectorAll(".size-dot").forEach(dot => {
        dot.addEventListener("click", function () {
            const size = parseInt(this.dataset.size);
            setCurrentSize(size);
            if (sizeSlider)  sizeSlider.value = size;
            if (sizeValue)   sizeValue.textContent = size + "px";
            updateSizeUI(size);
        });
    });

    // --- تبديل أقسام شريط الأدوات (Toolbar Section Toggles) ---
    document.querySelectorAll('.toggle-section').forEach(button => {
        button.addEventListener('click', function () {
            const content = document.getElementById(this.dataset.target);
            if (content) {
                content.classList.toggle('hidden');
                const icon = this.querySelector('i');
                if (icon) {
                    icon.classList.toggle('fa-chevron-down');
                    icon.classList.toggle('fa-chevron-up');
                }
            }
        });
    });

    document.querySelectorAll('.toggle-sidebar-section').forEach(button => {
        button.addEventListener('click', function () {
            const content = document.getElementById(this.dataset.target);
            if (content) {
                content.classList.toggle('hidden');
                const icon = this.querySelector('i');
                if (icon) {
                    icon.classList.toggle('fa-chevron-down');
                    icon.classList.toggle('fa-chevron-up');
                }
            }
        });
    });

    // --- مزج الألوان (Color Mixing) ---
    setupColorMixing();

    console.log("تم تسجيل معالجات الأحداث بنجاح");
}

// -------------------- بدء التشغيل (App Start) --------------------

window.addEventListener("load", initApp);
