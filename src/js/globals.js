const root = document.documentElement;
const cssVars = getComputedStyle(root);

function toMs(value) {
    value = value.trim();

    if (value.endsWith("ms")) return parseFloat(value);
    if (value.endsWith("s")) return parseFloat(value) * 1000;

    return parseFloat(value); // fallback
}

export const THEME = {
    speedFast: toMs(cssVars.getPropertyValue("--transition-speed")),
    speedSlow: toMs(cssVars.getPropertyValue("--slow-transition-speed")),
    gradientMin: cssVars.getPropertyValue("--gradient-min"),
    gradientMid: cssVars.getPropertyValue("--gradient-mid"),
    gradientMax: cssVars.getPropertyValue("--gradient-max"),
    previewScale: cssVars.getPropertyValue("--preview-scale"),
    bgColor: cssVars.getPropertyValue("--bg-color"),
    nodeBorderColor: cssVars.getPropertyValue("--node-border-color"),

    defaultNodeRadius_min: 10,
    defaultNodeRadius_max: 40,
    defaultNodeCharge: -400,
    nodeChargeFlex: 100,

    similarityExponent: 2.5,
    criticalSimilarityThreshold: 35, // [XX]%
};
console.log(THEME);

export var audioBoom = new Audio('audio/easteregg.mp3');
export var audioRoll = new Audio('audio/music.mp3');
export let boomChance = 100; // 1 in boomChance of boom