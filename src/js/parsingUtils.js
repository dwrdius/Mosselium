import { fileMap, blobUrlMap } from "./mosselium.js";
import { THEME } from "./globals.js";

export function parseMoss(htmlText) {
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

// function recalculateAttributes(nodes) {
//     nodes.forEach(n => {
//         // size ∝ # of critical links
//         // color ∝ avg weight of exponentiated critical links
//         // charge ∝ defaultCharge - (flex * nodeMax / trueMax)

//         const radiusFlex = THEME.defaultNodeRadius_max - THEME.defaultNodeRadius_min;

//         n.radiusAttr = THEME.defaultNodeRadius_min + (radiusFlex) * n.degreeAboveThreshold / ???;
//         if (n.degreeAboveThreshold > 0) {
//             n.colorAttr = colorScale(n.sumAboveThresh.pow / n.degreeAboveThreshold);
//         }
//         else {
//             n.colorAttr = colorScale(n.sumAboveThresh.raw / n.degree);
//         }
//         n.chargeAttr = 
        
//         // { 
//         //     id, 
//         //     weightScore: 0, // deprecated soon
            
//         //     maxSimilarity: {raw: 0, pow: 0},
//         //     sumTotSimilarity: {raw: 0, pow: 0},
//         //     degree: 0, 
            
//         //     sumAboveThresh: {raw: 0, pow: 0},
//         //     degreeAboveThreshold: 0,
//         // }
//     });
// }

export function getNodesFromLinks(links) {
    const nodesMap = {};
    links.forEach(l => {
        [l.source, l.target].forEach(id => {
            if (!nodesMap[id]) {
                nodesMap[id] =  { 
                                    id, 
                                    weightScore: 0, // deprecated soon
                                    
                                    maxSimilarity: {raw: 0, pow: 0},
                                    sumTotSimilarity: {raw: 0, pow: 0},
                                    degree: 0, 
                                    
                                    sumAboveThresh: {raw: 0, pow: 0},
                                    degreeAboveThreshold: 0,

                                    radiusAttr: THEME.defaultNodeRadius_min,
                                    colorAttr: THEME.gradientMin,
                                    chargeAttr: THEME.defaultNodeCharge,
                                };
            }
            nodesMap[id].weightScore += Math.pow(l.weight, THEME.similarityExponent);
            
            if (nodesMap[id].maxSimilarity.raw < l.weight) {
                nodesMap[id].maxSimilarity.raw = l.weight;
                nodesMap[id].maxSimilarity.pow = Math.pow(l.weight/100, THEME.similarityExponent);
            }
            nodesMap[id].sumSimilarity.raw += l.weight;
            nodesMap[id].sumSimilarity.pow += Math.pow(l.weight/100, THEME.similarityExponent);
            nodesMap[id].degree++;

            if (l.weight > THEME.criticalSimilarityThreshold) {
                nodesMap[id].sumAboveThresh.raw += l.weight;
                nodesMap[id].sumAboveThresh.pow += Math.pow(l.weight/100, THEME.similarityExponent);
                nodesMap[id].degreeAboveThreshold++;
            }
        });
    });

    // return recalcuateAttributes(Object.values(nodesMap));

    return Object.values(nodesMap);
}

export function normalizeHTMLHeaders(html) {
    let output = html;

    // Ensure DOCTYPE
    if (!/<!doctype/i.test(output)) {
        output = "<!DOCTYPE html>\n" + output;
    }

    // Ensure charset in head
    if (!/charset=/i.test(output)) {
        output = output.replace(
            /<head[^>]*>/i,
            match => `${match}\n<meta charset="UTF-8">`
        );
    }

    return output;
}

export async function getProcessedHtml(fileName) {
    const file = fileMap[fileName];
    if (!file) return "";
    let html = await file.text();
    return html.replace(/(href|src|SRC|HREF)="([^"]+)"/g, (match, attr, path) => {
        if (blobUrlMap[path]) return `${attr}="${blobUrlMap[path]}"`;
        return match;
    });
}
