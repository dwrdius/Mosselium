import { 
    clearPreview, 
    showPreview, 
    handleMousePreviewSide, 
    disablePreviewPointerEvents, 
    updatePreviewTimer, 
    enablePreview 
} from "./previews.js";
import { showTooltip, hideTooltip, updateTooltipPosition } from "./tooltips.js";
import { THEME, audioBoom, audioRoll, boomChance } from "./globals.js";
import { parseMoss, getProcessedHtml, normalizeHTMLHeaders } from "./parsingUtils.js";

export let fileMap = {}, blobUrlMap = {};
let currentLinks = [], currentNodes = []
let allLinks = [], allNodes = [];
let colorScale = d3.scaleLinear().domain([0, 0.5, 1]).range([THEME.gradientMin, THEME.gradientMid, THEME.gradientMax]);
let simulation, svg, container, zoom;
let selectedNodeIds = new Set();
let selectedLink = null;
let recenterOnClick = true;
let hoveredLinkData = null;

const isMac = /Mac/i.test(navigator.userAgent);
const cmdKeyName = isMac ? "⌘ Command" : "Ctrl";
const edgeScale = d3.scalePow().exponent(THEME.power).domain([0, 100]).range([2, 20]);

let folderInput, uploadBtn, resetBtn, select, autoRecenterToggle;

function initDOMReferences() {
    folderInput = document.getElementById("folderInput");
    uploadBtn = document.getElementById("uploadBtn");
    resetBtn = document.getElementById("resetBtn");
    select = document.getElementById("topLinks");
    autoRecenterToggle = document.getElementById("autoRecenter");
}

document.addEventListener("DOMContentLoaded", () => {
    initDOMReferences();

    if (folderInput) folderInput.value = '';
    
    document.getElementById('shortcuts-info').innerHTML = `
        • <b>${cmdKeyName} + Click</b>: Multi-select (Connected only)<br>
        • <b>Hover Link</b>: View Similarity %<br>
        • <b>Shift + Hover</b>: Quick Peek
        `;
    
    disablePreviewPointerEvents();

    svg = d3.select("#graph");
    container = svg.append("g");

    setupGradients();

    zoom = d3.zoom()
        .scaleExtent([0.1, 8])
        .on("zoom", (e) => {
            container.attr("transform", e.transform);
            if (e.sourceEvent) {
                select.value = "";
            }
        });
    svg.call(zoom);

    select.onchange = (e) => {
        const linkObj = currentLinks[e.target.value];
        if (linkObj) {
            selectedNodeIds.clear();
            selectedNodeIds.add(currentLinks[e.target.value].source.id);
            selectedNodeIds.add(currentLinks[e.target.value].target.id);
            console.log(selectedNodeIds);
            updateMultiSelection(true);
        }
    };

    svg.on("click", (e) => {
        if (e.target.tagName === "svg") {
            clearPreview();
            selectedNodeIds.clear();
            resetGraph(false);
        }
    });

    uploadBtn.onclick = () => folderInput.click();
    resetBtn.onclick = () => resetGraph(true);

    folderInput.onchange = async (e) => {
        const files = e.target.files;
        if (files.length === 0) return;

        for (const fileName in blobUrlMap) {
            URL.revokeObjectURL(blobUrlMap[fileName]);
        }

        fileMap = {};
        blobUrlMap = {};
        
        for (const f of Array.from(files)) {
            fileMap[f.name] = f;
            const reader = new FileReader();
            reader.onload = (e) => {
                let content = e.target.result;
                content = normalizeHTMLHeaders(content);
                const blob = new Blob([content], { type: "text/html" });
                blobUrlMap[f.name] = URL.createObjectURL(blob);
            };
            reader.readAsText(f, "UTF-8");
        }

        let readableFile = fileMap["_readable.html"];
        if (!readableFile) {
            alert("Error: '_readable.html' not found. Attempting to use 'readable.html'");
            readableFile = fileMap["readable.html"];
            if (!readableFile) {
                alert("Error: 'readable.html' is missing as well. Please try again.");
                return;
            }
        }
        const text = await readableFile.text();
        allLinks = parseMoss(text);
        currentLinks = allLinks;
        generateGraph(currentLinks);
        folderInput.value = '';
    };   

    autoRecenterToggle.addEventListener("change", () => {
        recenterOnClick = autoRecenterToggle.checked;
        console.log(recenterOnClick);
    });
});

window.addEventListener("keydown", (e) => {
    if (e.shiftKey && hoveredLinkData) {
        showPreview(hoveredLinkData);
    }
});

function refreshDropdown() {
    const select = document.getElementById("topLinks");
    select.innerHTML = '<option value="">-- Jump to Match --</option>';
    
    currentLinks
        .sort((a, b) => b.weight - a.weight)
        .forEach((l, i) => {
            const opt = document.createElement("option");
            opt.value = i;
            // Access .id because D3 converts strings to objects: {id: "name", x: 0, y: 0}
            const sName = l.source.id || l.source;
            const tName = l.target.id || l.target;
            opt.text = `${Math.round(l.weight)}%: ${sName} - ${tName}`;
            select.appendChild(opt);
        });
}

function linkKey(d) {
    const s = d.source.id || d.source;
    const t = d.target.id || d.target;
    return `${s}|${t}`;
}

function removeOrphanNodes() {
    const connected = new Set();

    currentLinks.forEach(l => {
        const s = l.source.id || l.source;
        const t = l.target.id || l.target;
        connected.add(s);
        connected.add(t);
    });

    currentNodes = currentNodes.filter(n => connected.has(n.id));

    simulation.nodes(currentNodes);
    simulation.force("link").links(currentLinks);
    simulation.alpha(0.3).restart();
}

// deletion
window.addEventListener("keydown", (e) => {
    if (selectedNodeIds.size > 0 && (e.key == "Backspace" || e.key == "Delete")) {
        // if (hoveredLinkData 
        // && selectedNodeIds.has(hoveredLinkData.source.id || hoveredLinkData.source)
        // && selectedNodeIds.has(hoveredLinkData.target.id || hoveredLinkData.target)) {
        //     hideTooltip();
        // }
        
        currentNodes = currentNodes.filter(n => !selectedNodeIds.has(n.id));

        currentLinks = currentLinks.filter(l => {
            const s = l.source.id || l.source;
            const t = l.target.id || l.target;
            return !selectedNodeIds.has(s) && !selectedNodeIds.has(t);
        });

        simulation.nodes(currentNodes);
        simulation.force("link").links(currentLinks);
        simulation.alpha(0.3).restart();

        removeOrphanNodes();
        
        // Update the SVG Elements
        const nodeSel = container.selectAll(".node").data(currentNodes, d => d.id);
        nodeSel.exit().transition().duration(THEME.speedFast).attr("r", 0).remove();

        const labelSel = container.selectAll(".label").data(currentNodes, d => d.id);
        labelSel.exit().remove();

        const linkSel = container.selectAll(".link").data(currentLinks, linkKey);
        linkSel.exit().transition().duration(THEME.speedFast).attr("stroke-opacity", 0).remove().on("end", hideTooltip());

        refreshDropdown();
        clearPreview();
        selectedNodeIds.clear();
        
        // Reset visual styles for remaining elements
        setTimeout(() => resetGraph(false), THEME.speedFast + 10);
    }
});

window.addEventListener('resize', () => {
    if (simulation) simulation.force("center", d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2)).alpha(0.1).restart();
});

function containmentForce() {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const radius = Math.min(window.innerWidth, window.innerHeight) * 0.45;
    const strength = 0.05;

    return function(alpha) {
        for (const node of currentNodes) {
            const dx = node.x - centerX;
            const dy = node.y - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > radius) {
                const pull = (dist - radius) * strength * alpha;
                node.vx -= (dx / dist) * pull;
                node.vy -= (dy / dist) * pull;
            }
        }
    };
}

function generateGraph(links) {
    container.selectAll("*").remove();

    const nodesMap = {};
    let counter = 0;
    links.forEach(l => {
        [l.source, l.target].forEach(id => {
            if (!nodesMap[id]) nodesMap[id] = { id, weightScore: 0 };
            nodesMap[id].weightScore += Math.pow(l.weight, THEME.power);
        });
        counter++;
    });
    allNodes = Object.values(nodesMap);
    currentNodes = allNodes;

    refreshDropdown()

    const maxWeight = d3.max(currentNodes, d => d.weightScore);
    colorScale = d3.scaleLinear().domain([0, maxWeight*0.5, maxWeight]).range([THEME.gradientMin, THEME.gradientMid, THEME.gradientMax]);

    simulation = d3.forceSimulation(currentNodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(150))
        .force("charge", d3.forceManyBody().strength(-400))
        .force("center", d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2))
        .force("collision", d3.forceCollide().radius(d => 25 + (d.weightScore / maxWeight) * 20))
        .force("contain", containmentForce());

    const link = container.append("g").selectAll("line").data(links, linkKey).enter().append("line")
        .attr("class", "link")
        .attr("stroke", d => d3.interpolateReds(Math.min((d.weight / 70) ** 1.2, 1)))
        .attr("stroke-width", d => edgeScale(d.weight))
        .attr("stroke-opacity", 0.6)
        .on("mouseover", async (e, d) => {            
            hoveredLinkData = d;
            showTooltip(d);
            updatePreviewTimer("off");
            if (e.shiftKey) {
                enablePreview(d);
            }
        })
        .on("mouseout", () => { 
            hoveredLinkData = null; 
            hideTooltip();
            updatePreviewTimer("on");
        })
        .on("mousemove", function(e, d) {
            const tooltipCursorGap = 10;
            const tooltipEdgeGap = 20;
            const cursorThreshold = 50;
            const backlashBuffer = 50;

            handleMousePreviewSide(d, e.pageX, window.innerWidth, backlashBuffer, cursorThreshold);
            updateTooltipPosition(e.pageX, e.pageY, tooltipCursorGap, tooltipEdgeGap, backlashBuffer);
        })
        .on("click", async (e, d) => {
            e.stopPropagation();
            boom();
            if (e.shiftKey) {
                enablePreview(d, true);
            }
            else {
                const html = await getProcessedHtml(d.fileName);
                const win = window.open("", "_blank");
                win.document.write(html);
            }
        });

    const node = container.append("g").selectAll("circle").data(currentNodes).enter().append("circle")
        .attr("class", "node")
        .attr("r", d => 10 + (d.weightScore / maxWeight) * 30)
        .attr("fill", d => colorScale(d.weightScore))
        .on("click", (e, d) => {
            clearPreview();
            select.value = "";
            e.stopPropagation();
            handleNodeClick(e, d);
        })
        .call(d3.drag().on("start", dragStarted).on("drag", dragged).on("end", dragEnded));

    const label = container.append("g").selectAll("text").data(currentNodes).enter().append("text")
        .attr("class", "label").attr("dy", -20).attr("text-anchor", "middle")
        .text(d => d.id.split(/[\\/]/).pop());

    simulation.on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        node.attr("cx", d => d.x).attr("cy", d => d.y);
        label.attr("x", d => d.x).attr("y", d => d.y);
    });

    clearPreview();
    selectedNodeIds.clear();
    resetGraph(true);
}

function handleNodeClick(e, d) {
    const isMod = isMac ? e.metaKey : e.ctrlKey;
    boom(); 
    if (isMod && selectedNodeIds.size > 0) {
        const isConnected = currentLinks.some(l => {
            const sId = typeof l.source === 'object' ? l.source.id : l.source;
            const tId = typeof l.target === 'object' ? l.target.id : l.target;
            return (selectedNodeIds.has(sId) && tId === d.id) || 
                    (selectedNodeIds.has(tId) && sId === d.id);
        });

        if (isConnected) {
            if (selectedNodeIds.has(d.id)) selectedNodeIds.delete(d.id);
            else selectedNodeIds.add(d.id);
        } else {
            selectedNodeIds.clear();
            selectedNodeIds.add(d.id);
        }
    } else {
        selectedNodeIds.clear();
        selectedNodeIds.add(d.id);
    }

    updateMultiSelection(recenterOnClick);
}

function updateMultiSelection(recenter=false) {
    if (selectedNodeIds.size === 0) { resetGraph(false); return; }
    const linkElements = container.selectAll(".link");
    const nodeElements = container.selectAll(".node");

    let adjNodeIds = new Set();
    let linkMap = new Map();
    const extLink = {"opacity" : 0.04, "width" : 1, "ptrEvnts" : "none"};
    const adjLink = {"opacity" : 0.6, "width" : 6, "ptrEvnts" : "auto"};
    const intLink = {"opacity" : 1, "width" : 12, "ptrEvnts" : "auto"};
    linkElements.each(l => {
        const sId = l.source.id || l.source;
        const tId = l.target.id || l.target;
        
        const sSel = selectedNodeIds.has(sId);
        const tSel = selectedNodeIds.has(tId);
        if (sSel || tSel) {
            adjNodeIds.add(sId);
            adjNodeIds.add(tId);
            linkMap.set(l, (sSel && tSel) ? intLink : adjLink);
        }
        else {
            linkMap.set(l, extLink);
        }
    });

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let nodeMap = new Map();
    const adjNodeBorder = "#ccc";
    const extNodeBorder = "#333";
    nodeElements.each(d => {
        const baseColor = colorScale(d.weightScore);
        if (selectedNodeIds.has(d.id)) {
            nodeMap.set(d, {
                "fill": baseColor,
                "stroke": THEME.nodeBorderColor
            })
            minX = Math.min(minX, d.x);
            maxX = Math.max(maxX, d.x);
            minY = Math.min(minY, d.y);
            maxY = Math.max(maxY, d.y);
        }
        else if (adjNodeIds.has(d.id)) {
            nodeMap.set(d, {
                "fill": d3.interpolateRgb(baseColor, THEME.bgColor)(0.4),
                "stroke": adjNodeBorder
            });
            minX = Math.min(minX, d.x);
            maxX = Math.max(maxX, d.x);
            minY = Math.min(minY, d.y);
            maxY = Math.max(maxY, d.y);
        }
        else {
            nodeMap.set(d, {
                "fill": d3.interpolateRgb(baseColor, THEME.bgColor)(0.85),
                "stroke": extNodeBorder
            });
        }
    });

    linkElements.transition().duration(THEME.speedFast)
        .attr("stroke-opacity", l => linkMap.get(l)["opacity"])
        .attr("stroke-width", l => linkMap.get(l)["width"])
        .attr("pointer-events", l => linkMap.get(l)["ptrEvnts"]);
    
    nodeElements.classed("selected", n => selectedNodeIds.has(n.id))
        .transition().duration(THEME.speedFast)
        .attr("fill", d => nodeMap.get(d)["fill"])
        .attr("stroke", d => nodeMap.get(d)["stroke"]);

    if (recenter) {
        const padding = 40;
        const width = maxX - minX;
        const height = maxY - minY;

        const scaleX = (window.innerWidth) / (width + 2 * padding);
        const scaleY = (window.innerHeight) / (height + 2 * padding);

        const scale = Math.min(scaleX, scaleY);

        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;

        const transform = d3.zoomIdentity
            .translate(window.innerWidth / 2, window.innerHeight / 2)
            .scale(scale)
            .translate(-midX, -midY);

        svg.transition().duration(750).ease(d3.easePolyOut).call(zoom.transform, transform);
    }
}

function resetGraph(recenter=false) {
    if (recenter) svg.transition().duration(THEME.speedSlow).call(zoom.transform, d3.zoomIdentity);
    const edgeScale = d3.scalePow().exponent(THEME.power).domain([0, 100]).range([2, 20]);
    
    container.selectAll(".link").transition().duration(THEME.speedFast)
        .attr("stroke-opacity", 0.6)
        .attr("stroke-width", d => edgeScale(d.weight))
        .attr("pointer-events", "auto");
        
    container.selectAll(".node").classed("selected", false).transition().duration(THEME.speedFast)
        .attr("opacity", 1)
        .attr("fill", d => colorScale(d.weightScore))
        .attr("stroke", THEME.nodeBorderColor);
    
    document.getElementById("topLinks").value = "";
}

function setupGradients() {
    const grad = svg.append("defs").append("linearGradient").attr("id", "score-gradient").attr("x1", "0%").attr("x2", "100%");
    grad.append("stop").attr("offset", "0%").attr("stop-color", THEME.gradientMin);
    grad.append("stop").attr("offset", "50%").attr("stop-color", THEME.gradientMid);
    grad.append("stop").attr("offset", "100%").attr("stop-color", THEME.gradientMax);
}

function dragStarted(e, d) { 
    if (!e.active) simulation.alphaTarget(0.3).restart(); 
    d.fx = d.x; 
    d.fy = d.y; 
}
function dragged(e, d) { 
    d.fx = e.x; 
    d.fy = e.y; 
}
function dragEnded(e, d) { 
    if (!e.active) simulation.alphaTarget(0); 
    d.fx = null; 
    d.fy = null; 
}

function boom() {
    if (Math.random()*boomChance < 1) {
        audioBoom.play();
        audioRoll.play();
    }
}