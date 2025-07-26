// ============================================================================
// BACKGROUND.JS
// ============================================================================
// Service Worker for Chrome Extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Speedway Motors Auto Browser installed');
  
  // Set default settings
  chrome.storage.sync.set({
    settings: {
      mouseSpeed: 1.0,
      typingSpeed: 1.0,
      humanness: 0.8,
      debug: false,
      autoStart: false
    }
  });
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getSettings':
      chrome.storage.sync.get(['settings'], (result) => {
        sendResponse({ settings: result.settings || {} });
      });
      return true;
      
    case 'saveSettings':
      chrome.storage.sync.set({ settings: request.settings }, () => {
        sendResponse({ success: true });
      });
      return true;
      
    case 'executeScenario':
      // Forward to content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, request, sendResponse);
      });
      return true;
      
    case 'getStatus':
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, request, sendResponse);
      });
      return true;
  }
});