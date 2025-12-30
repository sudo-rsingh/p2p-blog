/**
 * P2P Content Loader
 *
 * Automatically loads any type of content from P2P hosts
 * Supports: images, videos, PDFs, text/markdown/HTML, and any other file type
 *
 * Usage:
 * 1. Include PeerJS: <script src="https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js"></script>
 * 2. Include this script: <script src="p2p-storage.js"></script>
 * 3. Use in HTML:
 *    - Images: <img data-p2p-src="PEER_ID:FILE_NAME" alt="Description">
 *    - Videos: <video data-p2p-src="PEER_ID:FILE_NAME" controls></video>
 *    - Text: <div data-p2p-src="PEER_ID:FILE_NAME" data-p2p-type="text"></div>
 *    - PDFs: <iframe data-p2p-src="PEER_ID:FILE_NAME" data-p2p-type="pdf"></iframe>
 *    - Generic: <div data-p2p-src="PEER_ID:FILE_NAME"></div>
 */

(function() {
    'use strict';

    // Connection pool to reuse connections to the same peer
    const connections = new Map();
    let localPeer = null;

    // Initialize local peer
    function initPeer() {
        if (localPeer) return Promise.resolve(localPeer);

        return new Promise((resolve, reject) => {
            localPeer = new Peer();

            localPeer.on('open', () => {
                console.log('[P2P Storage] Local peer initialized');
                resolve(localPeer);
            });

            localPeer.on('error', (err) => {
                console.error('[P2P Storage] Peer error:', err);
                reject(err);
            });
        });
    }

    // Connect to a peer and get content
    function fetchContent(peerId, contentName) {
        return new Promise(async (resolve, reject) => {
            try {
                await initPeer();

                // Check if we already have a connection to this peer
                let conn = connections.get(peerId);

                if (!conn || !conn.open) {
                    // Create new connection
                    conn = localPeer.connect(peerId);
                    connections.set(peerId, conn);

                    conn.on('open', () => {
                        console.log(`[P2P Storage] Connected to peer: ${peerId}`);
                        requestContent(conn, contentName, resolve, reject);
                    });

                    conn.on('error', (err) => {
                        console.error(`[P2P Storage] Connection error:`, err);
                        reject(err);
                    });
                } else {
                    // Reuse existing connection
                    requestContent(conn, contentName, resolve, reject);
                }
            } catch (err) {
                reject(err);
            }
        });
    }

    function requestContent(conn, contentName, resolve, reject) {
        // Set up listener for response
        const dataHandler = (data) => {
            if (data.type === 'content' && data.contentName === contentName) {
                conn.off('data', dataHandler);
                resolve({
                    data: data.data,
                    mimeType: data.mimeType,
                    fileName: data.contentName
                });
            } else if (data.type === 'error') {
                conn.off('data', dataHandler);
                reject(new Error(data.message));
            }
        };

        conn.on('data', dataHandler);

        // Request the content
        conn.send({
            type: 'request',
            contentName: contentName
        });
    }

    // Render content based on MIME type
    function renderContent(element, contentData, mimeType, fileName) {
        const tagName = element.tagName.toLowerCase();

        if (tagName === 'img') {
            // Image element
            element.src = contentData;
        } else if (tagName === 'video') {
            // Video element
            element.src = contentData;
        } else if (tagName === 'audio') {
            // Audio element
            element.src = contentData;
        } else if (tagName === 'iframe') {
            // PDF or other embeddable content
            element.src = contentData;
        } else {
            // Generic div/span - render based on MIME type
            if (mimeType.startsWith('image/')) {
                const img = document.createElement('img');
                img.src = contentData;
                img.alt = fileName;
                img.style.maxWidth = '100%';
                element.appendChild(img);
            } else if (mimeType.startsWith('video/')) {
                const video = document.createElement('video');
                video.src = contentData;
                video.controls = true;
                video.style.maxWidth = '100%';
                element.appendChild(video);
            } else if (mimeType.startsWith('audio/')) {
                const audio = document.createElement('audio');
                audio.src = contentData;
                audio.controls = true;
                element.appendChild(audio);
            } else if (mimeType === 'application/pdf') {
                const iframe = document.createElement('iframe');
                iframe.src = contentData;
                iframe.style.width = '100%';
                iframe.style.minHeight = '600px';
                element.appendChild(iframe);
            } else if (mimeType.startsWith('text/')) {
                // Text content - decode from base64 and display
                try {
                    const base64Data = contentData.split(',')[1];
                    const decodedText = atob(base64Data);

                    if (mimeType === 'text/html') {
                        element.innerHTML = decodedText;
                    } else {
                        const pre = document.createElement('pre');
                        pre.style.whiteSpace = 'pre-wrap';
                        pre.style.wordWrap = 'break-word';
                        pre.textContent = decodedText;
                        element.appendChild(pre);
                    }
                } catch (e) {
                    console.error('[P2P Storage] Failed to decode text content:', e);
                    element.textContent = 'Error decoding text content';
                }
            } else {
                // Unknown type - provide download link
                const link = document.createElement('a');
                link.href = contentData;
                link.download = fileName;
                link.textContent = `Download ${fileName}`;
                link.style.padding = '10px';
                link.style.background = '#007bff';
                link.style.color = 'white';
                link.style.textDecoration = 'none';
                link.style.borderRadius = '5px';
                link.style.display = 'inline-block';
                element.appendChild(link);
            }
        }
    }

    // Process all elements with data-p2p-src attribute
    async function loadP2PContent() {
        const elements = document.querySelectorAll('[data-p2p-src]');

        if (elements.length === 0) {
            return;
        }

        console.log(`[P2P Storage] Found ${elements.length} P2P content element(s) to load`);

        for (const element of elements) {
            const p2pSrc = element.getAttribute('data-p2p-src');

            // Parse PEER_ID:CONTENT_NAME format
            const [peerId, contentName] = p2pSrc.split(':');

            if (!peerId || !contentName) {
                console.error(`[P2P Storage] Invalid format for: ${p2pSrc}. Expected PEER_ID:CONTENT_NAME`);
                continue;
            }

            // Show loading state
            const originalOpacity = element.style.opacity;
            element.style.opacity = '0.5';
            element.title = 'Loading from P2P...';

            try {
                const { data, mimeType, fileName } = await fetchContent(peerId, contentName);
                renderContent(element, data, mimeType, fileName);
                element.style.opacity = originalOpacity || '1';
                element.title = '';
                console.log(`[P2P Storage] Loaded: ${contentName} (${mimeType})`);
            } catch (err) {
                console.error(`[P2P Storage] Failed to load ${contentName}:`, err);
                element.style.opacity = originalOpacity || '1';
                element.title = 'Failed to load content';
                if (element.tagName.toLowerCase() === 'img') {
                    element.alt = `[Failed to load: ${contentName}]`;
                } else {
                    element.textContent = `Failed to load: ${contentName}`;
                }
            }
        }
    }

    // Auto-load when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadP2PContent);
    } else {
        loadP2PContent();
    }

    // Expose function globally for manual loading
    window.loadP2PContent = loadP2PContent;

})();
