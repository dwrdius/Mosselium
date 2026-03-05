document.addEventListener("DOMContentLoaded", () => {
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

window.addEventListener('resize', () => {
    if (simulation) simulation.force("center", d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2)).alpha(0.1).restart();
});

autoRecenterToggle.addEventListener("change", () => {
    recenterOnClick = autoRecenterToggle.checked;
    console.log(recenterOnClick);
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
            hoveredLinkData = d;
            hoveredLinkElement = e;

            tooltip.style("visibility", "visible").html(`Similarity: <strong>${Math.round(d.weight)}%</strong>`);

            updatePreviewTimer("off");

            if (e.shiftKey) {
                enablePreview(d);
            }
        })
        .on("mouseout", () => { 
            hoveredLinkData = null; 
            tooltip.style("visibility", "hidden"); 
            
            updatePreviewTimer("on");
        })
        .on("mousemove", function(e, d) {
            const tooltipNode = tooltip.node();
            const tooltipHeight = tooltipNode.offsetHeight;
            const tooltipWidth = tooltipNode.offsetWidth;
            
            const tooltipCursorGap = 10;
            const tooltipEdgeGap = 20;
            const cursorThreshold = 50;
            const backlashBuffer = 50;

            handleMousePreviewSide(d, e.pageX, window.innerWidth, backlashBuffer, cursorThreshold);

            const spaceAbove = e.pageY;
            if (tooltipVertical === "top" && spaceAbove < (tooltipHeight + tooltipCursorGap + tooltipEdgeGap)) {
                tooltipVertical = "bottom";
            } 
            else if (tooltipVertical === "bottom" && spaceAbove > (tooltipHeight + tooltipCursorGap + backlashBuffer)) {
                tooltipVertical = "top";
            }

            const spaceRight = (getPreviewSide() == "left") 
                                    ? window.innerWidth - e.pageX 
                                    : getPreviewInnerCoord() - e.pageX;
            console.log(spaceRight);
            if (tooltipSide === "right" && spaceRight < (tooltipWidth + tooltipCursorGap + tooltipEdgeGap)) {
                tooltipSide = "left";
            } 
            else if (tooltipSide === "left" && spaceRight > (tooltipWidth + tooltipCursorGap + backlashBuffer)) {
                tooltipSide = "right";
            }

            const vert = (tooltipVertical === "top") 
                ? (e.pageY - tooltipHeight - tooltipCursorGap) 
                : (e.pageY + tooltipHeight + tooltipCursorGap);
                
            const horiz = (tooltipSide === "right") 
                ? (e.pageX + tooltipCursorGap) 
                : (e.pageX - tooltipWidth - tooltipCursorGap);

            tooltip
                .style("top", `${vert}px`)
                .style("left", `${horiz}px`);
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