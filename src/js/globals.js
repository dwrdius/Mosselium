const root = document.documentElement;
const cssVars = getComputedStyle(root);

function toMs(value) {
    value = value.trim();

    if (value.endsWith("ms")) return parseFloat(value);
    if (value.endsWith("s")) return parseFloat(value) * 1000;

    return parseFloat(value); // fallback
}

const THEME = {
    speedFast: toMs(cssVars.getPropertyValue("--transition-speed")),
    speedSlow: toMs(cssVars.getPropertyValue("--slow-transition-speed")),
    gradientMin: cssVars.getPropertyValue("--gradient-min"),
    gradientMid: cssVars.getPropertyValue("--gradient-mid"),
    gradientMax: cssVars.getPropertyValue("--gradient-max"),
    previewScale: cssVars.getPropertyValue("--preview-scale"),
    bgColor: cssVars.getPropertyValue("--bg-color"),
    nodeBorderColor: cssVars.getPropertyValue("--node-border-color"),
    power: 2.5,
};
console.log(THEME);

let colorScale = d3.scaleLinear().domain([0, 0.5, 1]).range([THEME.gradientMin, THEME.gradientMid, THEME.gradientMax]);
let simulation, svg, container, zoom;
let currentLinks = [], currentNodes = [], fileMap = {}, blobUrlMap = {};
let selectedNodeIds = new Set();
let selectedLink = null;
let tooltipSide = "right";
let tooltipVertical = "top";
let recenterOnClick = true;

var audioBoom = new Audio('../audio/easteregg.mp3');
var audioRoll = new Audio('../audio/music.mp3');
let boomChance = 100; // 1 in boomChance of boom

const isMac = /Mac/i.test(navigator.userAgent);
const cmdKeyName = isMac ? "⌘ Command" : "Ctrl";
const edgeScale = d3.scalePow().exponent(THEME.power).domain([0, 100]).range([2, 20]);

const folderInput = document.getElementById("folderInput");
const uploadBtn = document.getElementById("uploadBtn");
const resetBtn = document.getElementById("resetBtn");
const select = document.getElementById("topLinks");
const autoRecenterToggle = document.getElementById("autoRecenter");

// ------------------------------------------------------------

let isPinnedPreview = false;
let previewOn = false;
let previewSide = "left";
let previewTimeout = null;
let currentPreview = null;
let pinnedPreview = null;

const PREVIEW_HIDE_DELAY = 400;

const previewWindow = document.getElementById("preview-window");
const previewScale = document.getElementById("previewScale");
const previewFrame = document.getElementById("preview-frame");