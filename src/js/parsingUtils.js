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

function normalizeHTMLHeaders(html) {
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

async function getProcessedHtml(fileName) {
    const file = fileMap[fileName];
    if (!file) return "";
    let html = await file.text();
    return html.replace(/(href|src|SRC|HREF)="([^"]+)"/g, (match, attr, path) => {
        if (blobUrlMap[path]) return `${attr}="${blobUrlMap[path]}"`;
        return match;
    });
}
