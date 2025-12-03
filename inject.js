(function() {
    'use strict';
    console.log('[YT Handle Enhancer] Inject script loaded.');

    const channelHandleCache = new Map();
    let displayMode = 'both'; // 'both', 'name', 'handle'

    // Listen for display mode changes
    window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        if (event.data.type === 'displayModeChanged') {
            displayMode = event.data.mode;
            console.log(`[YT Handle Enhancer] Display mode changed to: ${displayMode}`);
            // Update all existing messages
            updateAllMessages();
        }
    });

    // Load initial display mode from storage
    window.postMessage({ type: 'getDisplayMode' }, '*');

    const fetchHandle = async (channelId) => {
        console.log(`[YT Handle Enhancer] Fetching RSS feed to get channel title for: ${channelId}`);
        try {
            const response = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
            if (!response.ok) {
                console.error(`[YT Handle Enhancer] RSS Feed fetch failed with status: ${response.status}`);
                return null;
            }

            const text = await response.text();
            
            // Extract the <title> tag content
            const titleMatch = text.match(/<title>([^<]+)<\/title>/);
            
            if (titleMatch && titleMatch[1]) {
                const channelTitle = titleMatch[1];
                console.log(`[YT Handle Enhancer] Found channel title in RSS feed: ${channelTitle}`);
                return channelTitle; // Returning the title instead of the handle
            }

            console.warn(`[YT Handle Enhancer] Could not find <title> in RSS feed for ${channelId}`);
            return null;

        } catch (error) {
            console.error('[YT Handle Enhancer] Failed to fetch or parse RSS feed for title:', error);
        }
        return null;
    };

    const updateAuthorName = (authorChip, authorName, handle) => {
        const authorNameElement = authorChip.querySelector('#author-name');
        if (authorNameElement) {
            let displayText;
            switch (displayMode) {
                case 'name':
                    displayText = authorName;
                    break;
                case 'handle':
                    displayText = handle || authorName;
                    break;
                case 'both':
                default:
                    displayText = handle ? `${authorName} (${handle})` : authorName;
                    break;
            }

            console.log(`[YT Handle Enhancer] Updating display: ${authorName} -> ${displayText} (mode: ${displayMode})`);
            authorNameElement.textContent = displayText;
            authorChip.dataset.handleModified = 'true';
            authorChip.dataset.originalName = authorName;
            authorChip.dataset.channelHandle = handle || '';
        }
    };

    const updateAllMessages = () => {
        document.querySelectorAll('yt-live-chat-text-message-renderer').forEach(node => {
            const authorChip = node.querySelector('yt-live-chat-author-chip');
            if (authorChip && authorChip.dataset.originalName) {
                const authorName = authorChip.dataset.originalName;
                const handle = authorChip.dataset.channelHandle;
                updateAuthorName(authorChip, authorName, handle);
            }
        });
    };

    const processMessageNode = async (node) => {
        // Ensure it's a message renderer node
        if (node.nodeType !== 1 || !node.matches('yt-live-chat-text-message-renderer')) {
            return;
        }
        
        const authorChip = node.querySelector('yt-live-chat-author-chip');
        if (!authorChip) {
            // This can happen with system messages, so not necessarily an error.
            return;
        }
        if (authorChip.dataset.handleModified) {
            return; // Already processed
        }

        const data = node.__data || node.data;
        if (!data) {
            console.warn('[YT Handle Enhancer] No __data or data property found on message node.');
            return;
        }

        const authorName = data.authorName?.simpleText;
        const channelId = data.authorExternalChannelId;

        if(!authorName || !channelId) {
            console.warn('[YT Handle Enhancer] Could not find authorName or channelId in data object.', data);
            return;
        }

        console.log(`[YT Handle Enhancer] Found author: ${authorName}, channelId: ${channelId}`);

        if (channelHandleCache.has(channelId)) {
            const handle = channelHandleCache.get(channelId);
            if (handle) {
                updateAuthorName(authorChip, authorName, handle);
            }
        } else {
            channelHandleCache.set(channelId, null); // Mark as pending to avoid refetching
            const handle = await fetchHandle(channelId);
            if (handle) {
                channelHandleCache.set(channelId, handle);
                
                // Find all messages from the same author (including the current one) and update them
                document.querySelectorAll('yt-live-chat-text-message-renderer').forEach(n => {
                    const d = n.__data || n.data;
                    if (d && d.authorExternalChannelId === channelId) {
                        const c = n.querySelector('yt-live-chat-author-chip');
                        if (c) {
                            updateAuthorName(c, d.authorName.simpleText, handle);
                        }
                    }
                });
            }
        }
    };

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== 1) continue;
                
                if (node.matches('yt-live-chat-text-message-renderer')) {
                    processMessageNode(node);
                }
                node.querySelectorAll('yt-live-chat-text-message-renderer').forEach(processMessageNode);
            }
        }
    });

    const findChatAndStart = () => {
        const chat = document.querySelector('yt-live-chat-app');
        if (chat) {
            console.log('[YT Handle Enhancer] Chat app found. Starting main observer.');
            // Process existing messages first
            chat.querySelectorAll('yt-live-chat-text-message-renderer').forEach(processMessageNode);
            // Then observe for new ones
            observer.observe(chat, { childList: true, subtree: true });
            return true;
        }
        return false;
    };

    const bodyObserver = new MutationObserver((mutations, obs) => {
        if (findChatAndStart()) {
            console.log('[YT Handle Enhancer] Chat app appeared in DOM. Initializing.');
            obs.disconnect(); // We found the chat, no need to observe the whole body anymore
        }
    });

    // Initial check, in case the chat is already there
    if (!findChatAndStart()) {
        console.log('[YT Handle Enhancer] Chat app not found on initial load. Observing document body for changes.');
        // If not, wait for it to be added to the DOM
        bodyObserver.observe(document.body, { childList: true, subtree: true });
    }
})();
