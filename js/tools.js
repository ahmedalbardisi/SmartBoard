/**
 * السبورة الذكية - إدارة الأدوات
 * Smart Whiteboard - Tool Management
 */

// -------------------- تفعيل الأداة (Tool Activation) --------------------

function setActiveTool(tool) {
    // إشعار مدير الصور بتغيير الأداة (قبل تغيير currentTool)
    if (typeof onToolChange === 'function') onToolChange(tool);

    currentTool = tool;

    document.querySelectorAll(".tool-btn").forEach(btn => btn.classList.remove("active"));

    // إخفاء خيارات الجدول افتراضياً
    if (tableOptionsDiv) tableOptionsDiv.classList.add('hidden');

    let activeButton;
    switch (tool) {
        case "pen":          activeButton = penBtn;       break;
        case "highlight":    activeButton = highlightBtn; break;
        case "eraser":       activeButton = eraserBtn;    break;
        case "pan":          activeButton = panBtn;       break;
        case "rect":         activeButton = rectBtn;      break;
        case "circle":       activeButton = circleBtn;    break;
        case "line":         activeButton = lineBtn;      break;
        case "arrow":        activeButton = arrowBtn;     break;
        case "image-select": activeButton = document.getElementById('image-btn'); break;
        case "table":
            activeButton = tableBtn;
            if (tableOptionsDiv) tableOptionsDiv.classList.remove('hidden');
            break;
        default: activeButton = penBtn;
    }

    if (activeButton) {
        setActiveToolButton(activeButton);
    } else {
        console.error(`Active button not found for tool: ${tool}`);
    }

    setCanvasCursor(tool);
    console.log(`تم تفعيل أداة: ${tool}`);
}

function setActiveToolButton(button) {
    document.querySelectorAll(".tool-btn").forEach(btn => btn.classList.remove("active"));
    if (button) button.classList.add("active");
}

// -------------------- المؤشر (Cursor) --------------------

function setCanvasCursor(tool) {
    pages.forEach(page => {
        if (!page || !page.canvas) return;
        const canvas = page.canvas;
        canvas.classList.remove(
            "canvas-cursor-pen", "canvas-cursor-eraser", "canvas-cursor-highlight",
            "canvas-cursor-select", "canvas-cursor-text", "canvas-cursor-pan",
            "canvas-cursor-shape", "active"
        );
        switch (tool) {
            case "pen":          canvas.classList.add("canvas-cursor-pen");       break;
            case "highlight":    canvas.classList.add("canvas-cursor-highlight"); break;
            case "eraser":       canvas.classList.add("canvas-cursor-eraser");    break;
            case "pan":          canvas.classList.add("canvas-cursor-pan");       break;
            case "image-select": canvas.style.cursor = 'default';                 break;
            case "rect": case "circle": case "line": case "arrow": case "table":
                canvas.classList.add("canvas-cursor-shape"); break;
            default: canvas.style.cursor = 'default';
        }
    });
}

// -------------------- اللون (Color) --------------------

function setCurrentColor(color) {
    currentColor = color;
    console.log(`تم تغيير اللون إلى ${color}`);
}

function updateColorUI(color) {
    document.querySelectorAll(".color-circle").forEach(circle => {
        circle.classList.remove("selected");
        if (circle.dataset.color === color || rgbToHexFromStyle(circle.style.backgroundColor) === color) {
            circle.classList.add("selected");
        }
    });
    if (colorPicker) colorPicker.value = color;
}

// -------------------- الحجم (Size) --------------------

function setCurrentSize(size) {
    currentSize = size;
    console.log(`تم تغيير حجم القلم إلى ${size}px`);
}

function updateSizeUI(size) {
    document.querySelectorAll(".size-dot").forEach(dot => {
        dot.classList.remove("selected");
        if (parseInt(dot.dataset.size) === size) dot.classList.add("selected");
    });
    if (sizeValue) sizeValue.textContent = size + "px";
}

// -------------------- اختصارات لوحة المفاتيح (Keyboard Shortcuts) --------------------

function handleKeyShortcuts(e) {
    if (e.altKey) {
        switch (e.key) {
            case "h": setActiveTool("highlight"); break;
            case "p": setActiveTool("pen");       break;
            case "e": setActiveTool("eraser");    break;
            case "m": setActiveTool("pan");       break;
        }
    }
}
