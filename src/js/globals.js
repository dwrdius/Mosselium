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

    defaultNodeRadius_min: 15,
    radiusFlex: 20,
    degreeToNodeSideScalingFactor: 5,

    defaultNodeCharge: -500,
    nodeChargeFlex: 150,


    // make these into variables in an extended menu
    similarityExponent: 2,
    criticalSimilarityThreshold: 30, // [XX]%
    maxReasonableSimilarity: 50,
};
console.log(THEME);

export const colorScale = d3.scaleLinear().domain([0, 0.5, 1]).range([THEME.gradientMin, THEME.gradientMid, THEME.gradientMax]);

export var audioBoom = new Audio('audio/easteregg.mp3');
export var audioRoll = new Audio('audio/music.mp3');
export var audioError = new Audio('audio/error_windows_xp.mp3');
export var audioFAHHH = new Audio('audio/fahhhhh.mp3');
export let boomChance = 100; // 1 in boomChance of boom