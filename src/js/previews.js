const maxPreviewWidth = 0.7;
const resizeHandle = previewWindow.querySelector(".preview-resize-handle");
let resizing = false;

previewScale.addEventListener("input", () => {
    document.documentElement.style
        .setProperty("--preview-scale", previewScale.value);
});

function clearPreview() {
    isPinnedPreview = false;
    previewWindow.classList.remove("visible");
    previewWindow.style.width = "";
    currentPreview = null;
    pinnedPreview = null;
    previewOn = false;    
}

async function showPreview(d) {
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
            });
        });
    }

    previewWindow.style.borderColor = isPinnedPreview ? "var(--highlight)" : "var(--accent)";
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
    previewWindow.style.pointerEvents = "auto";
});