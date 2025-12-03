document.addEventListener('DOMContentLoaded', async () => {
    const radioButtons = document.querySelectorAll('input[name="displayMode"]');
    const statusDiv = document.getElementById('status');

    // Load saved settings
    const result = await chrome.storage.sync.get({ displayMode: 'both' });
    const savedMode = result.displayMode;

    // Set the radio button to match saved setting
    radioButtons.forEach(radio => {
        if (radio.value === savedMode) {
            radio.checked = true;
        }
    });

    // Save settings when changed
    radioButtons.forEach(radio => {
        radio.addEventListener('change', async (e) => {
            const mode = e.target.value;
            await chrome.storage.sync.set({ displayMode: mode });

            // Show status message
            statusDiv.textContent = '設定を保存しました';
            statusDiv.classList.add('show');

            // Send message to content scripts to update display
            const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'displayModeChanged',
                    mode: mode
                }).catch(() => {
                    // Ignore errors (tab might not have content script loaded)
                });
            });

            setTimeout(() => {
                statusDiv.classList.remove('show');
            }, 2000);
        });
    });
});
