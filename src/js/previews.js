import { getProcessedHtml } from "./parsingUtils.js";
import { updateTooltipPosition } from "./tooltips.js";

let isPinnedPreview = false;
let previewOn = false;
let previewSide = "left";
let previewTimeout = null;
let currentPreview = null;
let pinnedPreview = null;
let resizing = false;

const PREVIEW_HIDE_DELAY = 400;
const maxPreviewWidth = 0.7;

const previewWindow = document.getElementById("preview-window");
const previewScale = document.getElementById("previewScale");
const previewFrame = document.getElementById("preview-frame");
const resizeHandle = previewWindow.querySelector(".preview-resize-handle");

previewScale.addEventListener("input", () => {
    document.documentElement.style
        .setProperty("--preview-scale", previewScale.value);
});

export function clearPreview() {
    isPinnedPreview = false;
    previewWindow.classList.remove("visible");
    previewWindow.classList.remove("pinned");
    previewWindow.style.width = "";
    currentPreview = null;
    pinnedPreview = null;
    previewOn = false;  
}

export async function showPreview(d) {
    const oldSide = previewWindow.dataset.side;
    if (isPinnedPreview) {
        if (pinnedPreview == null) {
            pinnedPreview = d;
        }
        else {
            return;
        }
    }
    else if (!(oldSide && oldSide !== previewSide && previewOn) && currentPreview == d) return;
    currentPreview = d;

    const fixedHtml = await getProcessedHtml(d.fileName);
    previewFrame.srcdoc = fixedHtml;

    const handleTransitionEnd = (e) => {
        if (e.target !== previewWindow) return;
        
        updateTooltipPosition();
        previewWindow.removeEventListener("transitionend", handleTransitionEnd);
    };

    if (oldSide && oldSide !== previewSide && previewOn) {
        previewWindow.classList.remove("visible");
        await new Promise(resolve => {
            const onTransitionEnd = (e) => {
                if (e.propertyName === "transform") {
                    previewWindow.removeEventListener("transitionend", onTransitionEnd);
                    resolve();
                }
            };
            // Safety timeout in case transition is interrupted/skipped
            setTimeout(resolve, 600); 
            previewWindow.addEventListener("transitionend", onTransitionEnd);
        });

        previewWindow.style.transition = "none";
        applyPosition(previewSide);
        void previewWindow.offsetHeight; // Force reflow
        previewWindow.style.transition = "";

        requestAnimationFrame(() => {
            previewWindow.classList.add("visible");
            previewWindow.addEventListener("transitionend", handleTransitionEnd);
        });
    } 
    else if (!previewOn) {
        previewWindow.style.transition = "none";
        applyPosition(previewSide);
        previewWindow.offsetHeight; // force reflow
        previewWindow.style.transition = "";

        previewWindow.classList.remove("visible");
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                previewWindow.classList.add("visible");
                previewWindow.addEventListener("transitionend", handleTransitionEnd);
            });
        });
    }

    previewOn = true;
}

function applyPosition(side) {
    previewWindow.dataset.side = side;

    const controls = document.getElementById("controls");
    controls.dataset.side = side === "left" ? "right" : "left";
}

window.addEventListener("keyup", (e) => {
    if (e.key === "Shift" && !isPinnedPreview) {
        clearPreview();
    }
});

resizeHandle.addEventListener("mousedown", () => {
    resizing = true;
    previewWindow.style.pointerEvents = "none";
});

document.addEventListener("mousemove", (e) => {
    if (!resizing) return;

    const maxWidth = window.innerWidth * maxPreviewWidth;

    let newWidth;

    if (previewWindow.dataset.side === "right") {
        newWidth = window.innerWidth - e.clientX - 20;
    } else {
        newWidth = e.clientX - 20;
    }

    newWidth = Math.max(300, Math.min(newWidth, maxWidth));

    previewWindow.style.width = `${newWidth}px`;
});

document.addEventListener("mouseup", () => {
    resizing = false;
    previewWindow.style.pointerEvents = "";
});

export function handleMousePreviewSide(d, mousePageX, maxPos, backlashBuffer = 50, cursorGap = 50) {
    if (!isPinnedPreview) {
        const effectiveMousePos = mousePageX + cursorGap + previewWindow.offsetWidth;
        if (previewSide === "right" && effectiveMousePos > maxPos) {
            previewSide = "left";
            if (previewOn) showPreview(d);
        } 
        else if (previewSide === "left" && effectiveMousePos + backlashBuffer < maxPos) {
            previewSide = "right";
            if (previewOn) showPreview(d);
        }
    }
}

export function getPreviewSide() {
    return previewWindow.dataset.side;
}

export function getPreviewWidth() {
    return previewWindow.offsetWidth;
}

export function getPreviewInnerCoord() {
    if (getPreviewSide() == "left") {
        return previewWindow.getBoundingClientRect().right;
    }
    else {
        return previewWindow.getBoundingClientRect().left;
    }
}

export function disablePreviewPointerEvents() {
    previewWindow.style.pointerEvents = "none";
}

export function updatePreviewTimer(state) {
    if (isPinnedPreview) return;

    if (state === "on") {
        previewTimeout = setTimeout(() => {
            if (!isPinnedPreview) {
                clearPreview();
            }
        }, PREVIEW_HIDE_DELAY);
    }
    else if (previewTimeout) {
        clearTimeout(previewTimeout);
        previewTimeout = null;
    }
}

export function enablePreview(d, enablePin = false) {
    if (!isPinnedPreview) {
        if (enablePin) {
            isPinnedPreview = true;
            previewWindow.classList.add("pinned");
        }
        showPreview(d);
    }
}
