/**
 * P2P Image Loader
 *
 * Automatically loads images from P2P hosts
 *
 * Usage:
 * 1. Include PeerJS: <script src="https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js"></script>
 * 2. Include this script: <script src="p2p-image.js"></script>
 * 3. Use in HTML: <img data-p2p-src="PEER_ID:IMAGE_NAME" alt="Description">
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
                console.log('[P2P Images] Local peer initialized');
                resolve(localPeer);
            });

            localPeer.on('error', (err) => {
                console.error('[P2P Images] Peer error:', err);
                reject(err);
            });
        });
    }

    // Connect to a peer and get image
    function fetchImage(peerId, imageName) {
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
                        console.log(`[P2P Images] Connected to peer: ${peerId}`);
                        requestImage(conn, imageName, resolve, reject);
                    });

                    conn.on('error', (err) => {
                        console.error(`[P2P Images] Connection error:`, err);
                        reject(err);
                    });
                } else {
                    // Reuse existing connection
                    requestImage(conn, imageName, resolve, reject);
                }
            } catch (err) {
                reject(err);
            }
        });
    }

    function requestImage(conn, imageName, resolve, reject) {
        // Set up listener for response
        const dataHandler = (data) => {
            if (data.type === 'image' && data.imageName === imageName) {
                conn.off('data', dataHandler);
                resolve(data.data);
            } else if (data.type === 'error') {
                conn.off('data', dataHandler);
                reject(new Error(data.message));
            }
        };

        conn.on('data', dataHandler);

        // Request the image
        conn.send({
            type: 'request',
            imageName: imageName
        });
    }

    // Process all images with data-p2p-src attribute
    async function loadP2PImages() {
        const images = document.querySelectorAll('img[data-p2p-src]');

        if (images.length === 0) {
            return;
        }

        console.log(`[P2P Images] Found ${images.length} P2P image(s) to load`);

        for (const img of images) {
            const p2pSrc = img.getAttribute('data-p2p-src');

            // Parse PEER_ID:IMAGE_NAME format
            const [peerId, imageName] = p2pSrc.split(':');

            if (!peerId || !imageName) {
                console.error(`[P2P Images] Invalid format for: ${p2pSrc}. Expected PEER_ID:IMAGE_NAME`);
                continue;
            }

            // Show loading state
            img.style.opacity = '0.5';
            img.title = 'Loading from P2P...';

            try {
                const imageData = await fetchImage(peerId, imageName);
                img.src = imageData;
                img.style.opacity = '1';
                img.title = '';
                console.log(`[P2P Images] Loaded: ${imageName}`);
            } catch (err) {
                console.error(`[P2P Images] Failed to load ${imageName}:`, err);
                img.style.opacity = '1';
                img.title = 'Failed to load image';
                img.alt = `[Failed to load: ${imageName}]`;
            }
        }
    }

    // Auto-load when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadP2PImages);
    } else {
        loadP2PImages();
    }

    // Expose function globally for manual loading
    window.loadP2PImages = loadP2PImages;

})();
