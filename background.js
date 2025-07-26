// ============================================================================
// BACKGROUND.JS - Service Worker - Improved Version
// ============================================================================

console.log('[Speedway] Background script initializing...');

// Keep service worker alive
let keepAliveInterval;

// Track active tabs with injected scripts
const injectedTabs = new Set();

// Installation handler
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Speedway] Extension installed/updated:', details.reason);
  
  try {
    // Set default settings with quota check
    const defaultSettings = {
      mouseSpeed: 1.0,
      typingSpeed: 1.0,
      humanness: 0.8,
      debug: false,
      autoStart: false,
      version: '1.0.0',
      installDate: Date.now()
    };
    
    // Check storage quota before setting
    const bytesInUse = await chrome.storage.sync.getBytesInUse();
    const quotaBytes = chrome.storage.sync.QUOTA_BYTES || 102400;
    
    if (bytesInUse < quotaBytes * 0.8) { // Use max 80% of quota
      await chrome.storage.sync.set({ settings: defaultSettings });
      console.log('[Speedway] Default settings initialized');
    } else {
      console.warn('[Speedway] Storage quota nearly full, using minimal settings');
      await chrome.storage.sync.set({ 
        settings: { 
          mouseSpeed: 1.0, 
          typingSpeed: 1.0, 
          humanness: 0.8 
        } 
      });
    }
    
    // Setup keep alive
    setupKeepAlive();
    
  } catch (error) {
    console.error('[Speedway] Installation error:', error);
  }
});

// Service worker keep alive
function setupKeepAlive() {
  if (keepAliveInterval) clearInterval(keepAliveInterval);
  
  keepAliveInterval = setInterval(() => {
    // Ping to keep service worker active
    chrome.runtime.getPlatformInfo(() => {
      if (chrome.runtime.lastError) {
        console.log('[Speedway] Keep alive ping failed');
      }
    });
  }, 25000); // Every 25 seconds
}

// Message handler with enhanced error handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Speedway] Background received message:', request.action, 'from:', sender.tab?.id);
  
  // Handle async responses
  handleMessage(request, sender, sendResponse);
  return true; // Keep message channel open
});

async function handleMessage(request, sender, sendResponse) {
  try {
    switch (request.action) {
      case 'getSettings':
        await handleGetSettings(sendResponse);
        break;
        
      case 'saveSettings':
        await handleSaveSettings(request.settings, sendResponse);
        break;
        
      case 'executeScenario':
        await handleExecuteScenario(request, sender, sendResponse);
        break;
        
      case 'getStatus':
        await handleGetStatus(sender, sendResponse);
        break;
        
      case 'keepAlive':
        sendResponse({ alive: true, timestamp: Date.now() });
        break;
        
      case 'popupNotification':
        // Log and forward to other tabs if needed
        console.log('[Speedway] Popup notification:', request.event, request.data);
        sendResponse({ received: true });
        break;
        
      default:
        console.warn('[Speedway] Unknown action:', request.action);
        sendResponse({ error: 'Unknown action: ' + request.action });
    }
  } catch (error) {
    console.error('[Speedway] Message handling error:', error);
    sendResponse({ error: error.message });
  }
}

async function handleGetSettings(sendResponse) {
  try {
    const result = await chrome.storage.sync.get(['settings']);
    console.log('[Speedway] Settings retrieved:', Object.keys(result.settings || {}));
    sendResponse({ settings: result.settings || {} });
  } catch (error) {
    console.error('[Speedway] Error getting settings:', error);
    sendResponse({ error: error.message });
  }
}

async function handleSaveSettings(settings, sendResponse) {
  try {
    if (!settings || typeof settings !== 'object') {
      throw new Error('Invalid settings object');
    }
    
    // Validate settings structure
    const validKeys = ['mouseSpeed', 'typingSpeed', 'humanness', 'debug', 'autoStart'];
    const filteredSettings = {};
    
    for (const [key, value] of Object.entries(settings)) {
      if (validKeys.includes(key)) {
        filteredSettings[key] = value;
      }
    }
    
    // Add timestamp for tracking
    filteredSettings.lastUpdated = Date.now();
    
    await chrome.storage.sync.set({ settings: filteredSettings });
    console.log('[Speedway] Settings saved successfully');
    sendResponse({ success: true });
    
  } catch (error) {
    console.error('[Speedway] Error saving settings:', error);
    sendResponse({ error: error.message });
  }
}

async function handleExecuteScenario(request, sender, sendResponse) {
  if (!sender.tab || !sender.tab.id) {
    sendResponse({ error: 'No valid tab found' });
    return;
  }
  
  const tabId = sender.tab.id;
  
  try {
    // Ensure content script is injected
    await ensureContentScriptInjected(tabId);
    
    // Forward to content script with timeout
    const response = await sendMessageWithTimeout(tabId, request, 10000);
    sendResponse(response);
    
  } catch (error) {
    console.error('[Speedway] Error executing scenario:', error);
    sendResponse({ error: error.message });
  }
}

async function handleGetStatus(sender, sendResponse) {
  if (!sender.tab || !sender.tab.id) {
    sendResponse({ error: 'No valid tab found' });
    return;
  }
  
  try {
    const response = await sendMessageWithTimeout(
      sender.tab.id, 
      { action: 'getStatus' }, 
      5000
    );
    sendResponse(response);
  } catch (error) {
    console.error('[Speedway] Error getting status:', error);
    sendResponse({ error: error.message });
  }
}

// Enhanced message sending with timeout and retry
async function sendMessageWithTimeout(tabId, message, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Message timeout'));
    }, timeout);
    
    chrome.tabs.sendMessage(tabId, message, (response) => {
      clearTimeout(timeoutId);
      
      if (chrome.runtime.lastError) {
        // Retry once after short delay
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, message, (retryResponse) => {
            if (chrome.runtime.lastError) {
              reject(new Error('Content script not responding: ' + chrome.runtime.lastError.message));
            } else {
              resolve(retryResponse || {});
            }
          });
        }, 500);
      } else {
        resolve(response || {});
      }
    });
  });
}

// Ensure content script is properly injected
async function ensureContentScriptInjected(tabId) {
  if (injectedTabs.has(tabId)) {
    return; // Already injected
  }
  
  try {
    // Test if content script is already running
    await sendMessageWithTimeout(tabId, { action: 'ping' }, 2000);
    injectedTabs.add(tabId);
    console.log('[Speedway] Content script already active in tab:', tabId);
    
  } catch (error) {
    // Content script not responding, inject it
    try {
      const tab = await chrome.tabs.get(tabId);
      
      if (tab.url.includes('speedwaymotors.com') || tab.url.includes('localhost')) {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: [
            'content/human-simulator.js',
            'content/page-detector.js',
            'content/scenario-runner.js',
            'content/content.js'
          ]
        });
        
        injectedTabs.add(tabId);
        console.log('[Speedway] Content script injected into tab:', tabId);
        
        // Wait a bit for initialization
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (injectionError) {
      console.error('[Speedway] Failed to inject content script:', injectionError);
      throw new Error('Failed to inject content script: ' + injectionError.message);
    }
  }
}

// Tab management
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Remove from injected set when page changes
    if (changeInfo.url) {
      injectedTabs.delete(tabId);
    }
    
    // Auto-inject for target domains
    if (tab.url.includes('speedwaymotors.com') || tab.url.includes('localhost')) {
      console.log('[Speedway] Tab completed loading:', tab.url);
      
      try {
        // Small delay to ensure page is fully ready
        setTimeout(async () => {
          await ensureContentScriptInjected(tabId);
        }, 1000);
      } catch (error) {
        console.log('[Speedway] Auto-injection failed:', error.message);
      }
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  injectedTabs.delete(tabId);
});

// Navigation listener for better page change detection
chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId === 0) { // Main frame only
    const { tabId, url } = details;
    
    if (url.includes('speedwaymotors.com') || url.includes('localhost')) {
      console.log('[Speedway] Navigation completed:', url);
      
      // Notify content script about navigation if it exists
      try {
        await sendMessageWithTimeout(tabId, { 
          action: 'navigationCompleted', 
          url: url 
        }, 2000);
      } catch (error) {
        // Content script might not be ready yet, that's ok
        console.log('[Speedway] Navigation notification failed (normal):', error.message);
      }
    }
  }
});

// Cleanup on startup
chrome.runtime.onStartup.addListener(() => {
  console.log('[Speedway] Runtime startup - clearing injected tabs cache');
  injectedTabs.clear();
  setupKeepAlive();
});

// Global error handling
self.addEventListener('unhandledrejection', (event) => {
  console.error('[Speedway] Unhandled promise rejection in background:', event.reason);
});

// Setup keep alive immediately
setupKeepAlive();

console.log('[Speedway] Background script ready with enhanced features');