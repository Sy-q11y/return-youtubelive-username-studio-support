// Inject the script
const s = document.createElement('script');
s.src = chrome.runtime.getURL('inject.js');
s.onload = function() {
    this.remove();
};
(document.head || document.documentElement).appendChild(s);

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'displayModeChanged') {
        // Forward the message to the injected script
        window.postMessage({
            type: 'displayModeChanged',
            mode: message.mode
        }, '*');
    }
});

// Listen for fetchHandleRequest from page and forward to background
window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data || {};
    if (data.type === 'fetchHandleRequest' && data.channelId) {
        chrome.runtime.sendMessage({ type: 'fetchHandle', channelId: data.channelId, reqId: data.reqId }, (response) => {
            // respond back to page
            window.postMessage({ type: 'fetchHandleResponse', channelId: data.channelId, reqId: data.reqId, title: response?.title || null }, '*');
        });
    }
});

// Handle requests for current display mode from injected script
window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    if (event.data.type === 'getDisplayMode') {
        // Get the current display mode from storage and send it to the injected script
        const result = await chrome.storage.sync.get({ displayMode: 'both' });
        window.postMessage({
            type: 'displayModeChanged',
            mode: result.displayMode
        }, '*');
    }
});
