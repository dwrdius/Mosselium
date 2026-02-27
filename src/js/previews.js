let isPinned = false;
let previewOn = false;
let previewSide = "left";
let previewTimeout = null;
let currentPreview = null;
let pinnedPreview = null;

const HIDE_DELAY = 400;

const previewWindow = document.getElementById("preview-window");
const previewScale = document.getElementById("previewScale");
const previewFrame = document.getElementById("preview-frame");

previewScale.addEventListener("input", () => {
    document.documentElement.style
        .setProperty("--preview-scale", previewScale.value);
});

function clearPreview() {
    isPinned = false;
    previewWindow.classList.remove("visible");
    currentPreview = null;
    pinnedPreview = null;
    previewOn = false;
}

async function showPreview(d) {
    const oldSide = previewWindow.dataset.side;
    if (isPinned) {
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

    if (oldSide && oldSide !== previewSide && previewOn) {
        previewWindow.classList.remove("visible");

        await new Promise(resolve => {
            const onTransitionEnd = (e) => {
                if (e.propertyName === "transform" || e.propertyName === "opacity") {
                    previewWindow.removeEventListener("transitionend", onTransitionEnd);
                    resolve();
                }
            };
            previewWindow.addEventListener("transitionend", onTransitionEnd);
        });

        previewWindow.style.transition = "none";

        applyPosition(previewSide);
        previewWindow.dataset.side = previewSide;

        previewWindow.offsetHeight; 

        previewWindow.style.transition = "";

        requestAnimationFrame(() => {
            previewWindow.classList.add("visible");
        });
    } else {
        applyPosition(previewSide);
        previewWindow.dataset.side = previewSide;
        
        if (!previewOn) {
            requestAnimationFrame(() => {
                previewWindow.classList.remove("visible");
                requestAnimationFrame(() => {
                    previewWindow.classList.add("visible");
                });
            });
        }
    }

    previewWindow.style.borderColor = isPinned ? "var(--highlight)" : "var(--accent)";
    previewOn = true;
}

// Helper to handle the raw CSS positioning
function applyPosition(side) {
    const controls = document.getElementById("controls");
    previewWindow.style.left = side === "left" ? "20px" : "auto";
    previewWindow.style.right = side === "right" ? "20px" : "auto";
    
    const panelSide = side === "left" ? "right" : "left";
    controls.classList.remove("left", "right");
    controls.classList.add(panelSide);
}

window.addEventListener("keyup", (e) => {
    if (e.key === "Shift" && !isPinned) {
        clearPreview();
    }
});

async function getProcessedHtml(fileName) {
    const file = fileMap[fileName];
    if (!file) return "";
    let html = await file.text();
    return html.replace(/(href|src|SRC|HREF)="([^"]+)"/g, (match, attr, path) => {
        if (blobUrlMap[path]) return `${attr}="${blobUrlMap[path]}"`;
        return match;
    });
}