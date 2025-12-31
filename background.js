// background service worker (MV3)
// Listens for fetchHandle messages and performs cross-origin fetch to get channel RSS
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === 'fetchHandle' && message.channelId) {
        const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${message.channelId}`;
        fetch(url).then(async (resp) => {
            if (!resp.ok) return sendResponse({ title: null });
            const text = await resp.text();
            const m = text.match(/<title>([^<]+)<\/title>/);
            const title = (m && m[1]) ? m[1] : null;
            sendResponse({ title });
        }).catch((err) => {
            console.error('background fetch error', err);
            sendResponse({ title: null });
        });
        return true; // indicate async response
    }
});
