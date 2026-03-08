import { getPreviewSide, getPreviewInnerCoord } from "./previews.js";

let tooltipVertical = "top";
let tooltipSide = "right";
let prevX = 0;
let prevY = 0;
const tooltip = d3.select("#tooltip");
const tooltipNode = tooltip.node();
let isVisible = false;

export function showTooltip(d) {
    tooltip.style("visibility", "visible")
           .style("opacity", 1)
           .html(`Similarity: <strong>${Math.round(d.weight)}%</strong>`);

    isVisible = true;
    updateTooltipPosition();
}

export function hideTooltip() {
    tooltip.style("visibility", "hidden")
           .style("opacity", 0);
           
    isVisible = false;
}

export function updateTooltipPosition(x = -Infinity, y = -Infinity, tooltipCursorGap = 10, tooltipEdgeGap = 20, backlashBuffer = 50) {
    if (!isVisible) return;

    if (x == -Infinity) {
        x = prevX;
        y = prevY;
    }
    else {
        prevX = x;
        prevY = y;
    }

    const tooltipHeight = tooltipNode.offsetHeight;
    const tooltipWidth = tooltipNode.offsetWidth;

    const spaceRight = (getPreviewSide() == "left") 
                            ? window.innerWidth - x 
                            : getPreviewInnerCoord() - x;
    if (tooltipSide === "right" && spaceRight < (tooltipWidth + tooltipCursorGap + tooltipEdgeGap)) {
        tooltipSide = "left";
    } 
    else if (tooltipSide === "left" && spaceRight > (tooltipWidth + tooltipCursorGap + backlashBuffer)) {
        tooltipSide = "right";
    }

    const spaceAbove = y;
    if (tooltipVertical === "top" && spaceAbove < (tooltipHeight + tooltipCursorGap + tooltipEdgeGap)) {
        tooltipVertical = "bottom";
    } 
    else if (tooltipVertical === "bottom" && spaceAbove > (tooltipHeight + tooltipCursorGap + backlashBuffer)) {
        tooltipVertical = "top";
    }

    const horiz = (tooltipSide === "right") 
        ? (x + tooltipCursorGap) 
        : (x - tooltipWidth - tooltipCursorGap);

    const vert = (tooltipVertical === "top") 
        ? (y - tooltipHeight - tooltipCursorGap) 
        : (y + tooltipHeight + tooltipCursorGap);

    tooltip
        .style("top", `${vert}px`)
        .style("left", `${horiz}px`);
}