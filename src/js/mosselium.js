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
const autoRecenter = document.getElementById("autoRecenter");

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('shortcuts-info').innerHTML = `
        • <b>${cmdKeyName} + Click</b>: Multi-select (Connected only)<br>
        • <b>Hover Link</b>: View Similarity %<br>
        • <b>Shift + Hover</b>: Quick Peek
        `;
    
    previewWindow.style.pointerEvents = "none";

    svg = d3.select("#graph");
    container = svg.append("g");

    setupGradients();

    zoom = d3.zoom()
        .scaleExtent([0.1, 8])
        .on("zoom", (e) => {
            container.attr("transform", e.transform);
            if (e.sourceEvent) {
                document.getElementById("topLinks").value = "";
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
            blobUrlMap[f.name] = URL.createObjectURL(f);
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
        currentLinks = parseMoss(text);
        generateGraph(currentLinks);        
        folderInput.value = '';
    };   
});

window.addEventListener("keydown", (e) => {
    if (e.shiftKey && hoveredLinkData) {
        showPreview(hoveredLinkData);
    }
});

autoRecenter.addEventListener("change", () => {
    recenterOnClick = autoRecenter.checked;
    console.log(recenterOnClick);
});

function parseMoss(htmlText) {
    const doc = new DOMParser().parseFromString(htmlText, "text/html");
    const links = [];
    doc.querySelectorAll("table tr").forEach(row => {
        const anchors = row.querySelectorAll("a");
        if (anchors.length === 2) {
            const m1 = anchors[0].textContent.match(/(.*)\s\((\d+)%\)/);
            const m2 = anchors[1].textContent.match(/(.*)\s\((\d+)%\)/);
            if (m1 && m2) {
                links.push({
                    source: m1[1].trim(),
                    target: m2[1].trim(),
                    weight: (parseInt(m1[2]) + parseInt(m2[2])) / 2,
                    fileName: anchors[0].getAttribute("href")
                });
            }
        }
    });
    return links;
}

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
    const tooltip = d3.select("#tooltip");
    
    const nodesMap = {};
    links.forEach(l => {
        [l.source, l.target].forEach(id => {
            if (!nodesMap[id]) nodesMap[id] = { id, weightScore: 0 };
            nodesMap[id].weightScore += Math.pow(l.weight, THEME.power);
        });
    });
    currentNodes = Object.values(nodesMap);

    select.innerHTML = '<option value="">-- Jump to Match --</option>';
    links.sort((a,b) => b.weight - a.weight).forEach((l, i) => {
        const opt = document.createElement("option");
        opt.value = i;
        opt.text = `${Math.round(l.weight)}%: ${l.source} - ${l.target}`;
        select.appendChild(opt);
    });

    const maxWeight = d3.max(currentNodes, d => d.weightScore);
    colorScale = d3.scaleLinear().domain([0, maxWeight*0.5, maxWeight]).range([THEME.gradientMin, THEME.gradientMid, THEME.gradientMax]);

    simulation = d3.forceSimulation(currentNodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(150))
        .force("charge", d3.forceManyBody().strength(-400))
        .force("center", d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2))
        .force("collision", d3.forceCollide().radius(d => 25 + (d.weightScore / maxWeight) * 20))
        .force("contain", containmentForce());

    const link = container.append("g").selectAll("line").data(links).enter().append("line")
        .attr("class", "link")
        .attr("stroke", d => d3.interpolateReds(Math.min((d.weight / 70) ** 1.2, 1)))
        .attr("stroke-width", d => edgeScale(d.weight))
        .attr("stroke-opacity", 0.6)
        .on("mouseover", async (e, d) => {            
            if (previewTimeout) {
                clearTimeout(previewTimeout);
                previewTimeout = null;
            }

            hoveredLinkData = d;
            hoveredLinkElement = e;

            tooltip.style("visibility", "visible").html(`Similarity: <strong>${Math.round(d.weight)}%</strong>`);

            if (!isPinned && e.shiftKey) {
                showPreview(d);
            }
        })
        .on("mouseout", () => { 
            hoveredLinkData = null; 
            tooltip.style("visibility", "hidden"); 
            previewTimeout = setTimeout(() => {
                if (!isPinned) {
                    clearPreview();
                }
            }, HIDE_DELAY);
        })
        .on("mousemove", function(e, d) {
            const tooltipNode = tooltip.node();
            const tooltipHeight = tooltipNode.offsetHeight;
            const tooltipWidth = tooltipNode.offsetWidth;
            
            const cursorGap = 10;
            const buffer = 50; // Prevents jitter at the edges
            const edgeGap = 20;

            const spaceAbove = e.pageY;
            if (tooltipVertical === "top" && spaceAbove < (tooltipHeight + cursorGap + edgeGap)) {
                tooltipVertical = "bottom";
            } 
            else if (tooltipVertical === "bottom" && spaceAbove > (tooltipHeight + cursorGap + buffer)) {
                tooltipVertical = "top";
            }

            const spaceRight = window.innerWidth - e.pageX;
            if (tooltipSide === "right" && spaceRight < (tooltipWidth + cursorGap + edgeGap)) {
                tooltipSide = "left";
            } 
            else if (tooltipSide === "left" && spaceRight > (tooltipWidth + cursorGap + buffer)) {
                tooltipSide = "right";
            }
            if (!isPinned) {
                if (previewSide === "right" && e.pageX / window.innerWidth > 0.6) {
                    previewSide = "left";
                    if (previewOn) showPreview(d);
                } 
                else if (previewSide === "left" && (e.pageX + buffer) / window.innerWidth < 0.6) {
                    previewSide = "right";
                    if (previewOn) showPreview(d);
                }
            }

            // --- Apply Final Positions ---
            const vert = (tooltipVertical === "top") 
                ? (e.pageY - tooltipHeight - cursorGap) 
                : (e.pageY + tooltipHeight + cursorGap );
                
            const horiz = (tooltipSide === "right") 
                ? (e.pageX + cursorGap) 
                : (e.pageX - tooltipWidth - cursorGap);

            tooltip
                .style("top", `${vert}px`)
                .style("left", `${horiz}px`);
        })
        .on("click", async (e, d) => {
            e.stopPropagation();
            boom();
            if (e.shiftKey) {
                isPinned = true;
                previewWindow.style.pointerEvents = "auto";
                showPreview(d);
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

function boom() {
    if (Math.random()*boomChance < 1) {
        audioBoom.play();
        audioRoll.play();
    }
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
    const extLink = {"opacity" : 0.04, "width" : 1};
    const adjLink = {"opacity" : 0.6, "width" : 6};
    const intLink = {"opacity" : 1, "width" : 12};
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
        .attr("pointer-events", l => (linkMap[l] == 0) ? "none" : "auto");
    
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

function dragStarted(e, d) { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }
function dragged(e, d) { d.fx = e.x; d.fy = e.y; }
function dragEnded(e, d) { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }

window.addEventListener('resize', () => {
    if (simulation) simulation.force("center", d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2)).alpha(0.1).restart();
});