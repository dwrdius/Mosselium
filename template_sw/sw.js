const fileMap = new Map();

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // Immediately begin intercepting fetches for all open tabs
    event.waitUntil(clients.claim());
});

self.addEventListener('message', (event) => {
    if (event.data.type === 'REGISTER_FILES') {
        event.data.files.forEach(file => {
            fileMap.set(file.path, file.blob);
        });
    }
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    // Remove the leading slash to match webkitRelativePath
    const path = url.pathname.substring(1); 

    if (fileMap.has(path)) {
        const blob = fileMap.get(path);
        event.respondWith(
            new Response(blob, {
                headers: { 'Content-Type': blob.type || 'text/html' }
            })
        );
    }
});