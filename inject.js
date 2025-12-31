(function() {
    'use strict';
    // Detect if running inside the Studio live_chat iframe or similar
    const IN_LIVE_CHAT_FRAME = location.pathname.startsWith('/live_chat') || (window.frameElement && (window.frameElement.id === 'live-chat' || (window.frameElement.classList && window.frameElement.classList.contains('ytcp-live-chat-frame'))));
    // Debug mode: set to true to enable detailed logging
    const DEBUG = true;

    const channelHandleCache = new Map();
    let displayMode = 'both'; // 'both', 'name', 'handle'

    // Listen for display mode changes
    window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        if (event.data.type === 'displayModeChanged') {
            displayMode = event.data.mode;
            if (DEBUG) console.log(`[YT Handle Enhancer] Display mode changed to: ${displayMode}`);
            // Update all existing messages
            updateAllMessages();
        }
    });

    // Load initial display mode from storage
    window.postMessage({ type: 'getDisplayMode' }, '*');

    // Request RSS fetch via extension (content script -> background) to avoid CORS
    const fetchHandle = (channelId) => {
        if (DEBUG) console.log(`[YT Handle Enhancer] Requesting RSS fetch for: ${channelId}`);
        return new Promise((resolve) => {
            const reqId = `yt_handle_req_${channelId}_${Date.now()}`;
            const onResponse = (event) => {
                if (event.source !== window) return;
                const d = event.data || {};
                if (d.type === 'fetchHandleResponse' && d.reqId === reqId) {
                    window.removeEventListener('message', onResponse);
                    if (DEBUG) console.log('[YT Handle Enhancer] Received fetch response', d);
                    resolve(d.title || null);
                }
            };

            // Timeout fallback
            const timeout = setTimeout(() => {
                window.removeEventListener('message', onResponse);
                if (DEBUG) console.warn('[YT Handle Enhancer] fetchHandle timed out for', channelId);
                resolve(null);
            }, 8000);

            window.addEventListener('message', onResponse);
            // Send request to content script to forward to background
            window.postMessage({ type: 'fetchHandleRequest', channelId, reqId }, '*');
        });
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

            if (DEBUG) console.log(`[YT Handle Enhancer] Updating: ${authorName} -> ${displayText}`);
            authorNameElement.textContent = displayText;
            authorChip.dataset.handleModified = 'true';
            authorChip.dataset.originalName = authorName;
            authorChip.dataset.channelHandle = handle || '';
        }
    };

    const updateAllMessages = () => {
        const messageSelectors = [
            'yt-live-chat-text-message-renderer',
            'yt-live-chat-paid-message-renderer',
            'yt-live-chat-membership-item-renderer',
            'yt-live-chat-paid-sticker-renderer'
        ];

        messageSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(node => {
                const authorChip = node.querySelector('yt-live-chat-author-chip');
                if (authorChip && authorChip.dataset.originalName) {
                    const authorName = authorChip.dataset.originalName;
                    const handle = authorChip.dataset.channelHandle;
                    updateAuthorName(authorChip, authorName, handle);
                }
            });
        });
    };

    const processMessageNode = async (node) => {
        // Check if it's a text message or paid message (Super Chat, Super Sticker, membership)
        const isTextMessage = node.matches('yt-live-chat-text-message-renderer');
        const isPaidMessage = node.matches('yt-live-chat-paid-message-renderer');
        const isMembershipItem = node.matches('yt-live-chat-membership-item-renderer');
        const isPaidSticker = node.matches('yt-live-chat-paid-sticker-renderer');

        if (!isTextMessage && !isPaidMessage && !isMembershipItem && !isPaidSticker) {
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
            if (DEBUG) console.warn('[YT Handle Enhancer] No __data or data property found on message node.');
            return;
        }

        const authorName = data.authorName?.simpleText;
        const channelId = data.authorExternalChannelId;

        if(!authorName || !channelId) {
            if (DEBUG) console.warn('[YT Handle Enhancer] Could not find authorName or channelId in data object.');
            return;
        }

        if (DEBUG) console.log(`[YT Handle Enhancer] Processing: ${authorName} (${isPaidMessage ? 'Super Chat' : isTextMessage ? 'Text' : isMembershipItem ? 'Membership' : 'Sticker'})`);

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
                const selectors = [
                    'yt-live-chat-text-message-renderer',
                    'yt-live-chat-paid-message-renderer',
                    'yt-live-chat-membership-item-renderer',
                    'yt-live-chat-paid-sticker-renderer'
                ];

                selectors.forEach(selector => {
                    document.querySelectorAll(selector).forEach(n => {
                        const d = n.__data || n.data;
                        if (d && d.authorExternalChannelId === channelId) {
                            const c = n.querySelector('yt-live-chat-author-chip');
                            if (c) {
                                updateAuthorName(c, d.authorName.simpleText, handle);
                            }
                        }
                    });
                });
            }
        }
    };

    const observer = new MutationObserver((mutations) => {
        const messageSelectors = [
            'yt-live-chat-text-message-renderer',
            'yt-live-chat-paid-message-renderer',
            'yt-live-chat-membership-item-renderer',
            'yt-live-chat-paid-sticker-renderer'
        ];

        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== 1) continue;

                // Check if the node itself matches any of the message types
                for (const selector of messageSelectors) {
                    if (node.matches(selector)) {
                        processMessageNode(node);
                        break;
                    }
                }

                // Check for message nodes within the added node
                messageSelectors.forEach(selector => {
                    node.querySelectorAll(selector).forEach(processMessageNode);
                });
            }
        }
    });

    const findChatAndStart = () => {
        // Try a set of possible chat root selectors (covers Studio iframe variants)
        const rootSelectors = ['yt-live-chat-app', 'yt-live-chat-renderer', 'yt-live-chat-frame', 'ytd-live-chat-renderer', '#items'];
        let chat = null;
        for (const sel of rootSelectors) {
            chat = document.querySelector(sel);
            if (chat) break;
        }

        // If running inside known live_chat iframe and no specific root found, fallback to body
        if (!chat && IN_LIVE_CHAT_FRAME) {
            chat = document.body;
        }

        if (chat) {
            if (DEBUG) console.log('[YT Handle Enhancer] Chat app found. Starting observer. inLiveChatFrame=' + IN_LIVE_CHAT_FRAME);
            // Process existing messages first (all types)
            const messageSelectors = [
                'yt-live-chat-text-message-renderer',
                'yt-live-chat-paid-message-renderer',
                'yt-live-chat-membership-item-renderer',
                'yt-live-chat-paid-sticker-renderer'
            ];
            messageSelectors.forEach(selector => {
                chat.querySelectorAll(selector).forEach(processMessageNode);
            });
            // Then observe for new ones
            observer.observe(chat, { childList: true, subtree: true });
            return true;
        }
        return false;
    };

    const bodyObserver = new MutationObserver((mutations, obs) => {
        if (findChatAndStart()) {
            if (DEBUG) console.log('[YT Handle Enhancer] Chat app initialized.');
            obs.disconnect(); // We found the chat, no need to observe the whole body anymore
        }
    });

    // Initial check, in case the chat is already there
    if (!findChatAndStart()) {
        if (DEBUG) console.log('[YT Handle Enhancer] Waiting for chat app...');
        // If not, wait for it to be added to the DOM
        bodyObserver.observe(document.body, { childList: true, subtree: true });
    }
})();
