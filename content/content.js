// ============================================================================
// CONTENT/CONTENT.JS - Main Content Script
// ============================================================================
// Main content script that coordinates all modules
class SpeedwayAutoBrowser {
  constructor() {
    this.scenarioRunner = null;
    this.isInitialized = false;
    this.settings = {};
    
    this.init();
  }
  
  async init() {
    try {
      // Load settings
      await this.loadSettings();
      
      // Initialize modules
      this.scenarioRunner = new ScenarioRunner({
        debug: this.settings.debug,
        mouseSpeed: this.settings.mouseSpeed,
        typingSpeed: this.settings.typingSpeed,
        humanness: this.settings.humanness
      });
      
      // Setup event listeners
      this.setupEventListeners();
      
      this.isInitialized = true;
      console.log('🚀 Speedway Auto Browser initialized');
      
    } catch (error) {
      console.error('Failed to initialize Auto Browser:', error);
    }
  }
  
  async loadSettings() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
        this.settings = {
          mouseSpeed: 1.0,
          typingSpeed: 1.0,
          humanness: 0.8,
          debug: false,
          autoStart: false,
          ...response.settings
        };
        resolve();
      });
    });
  }
  
  setupEventListeners() {
    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open for async response
    });
    
    // Setup scenario callbacks
    this.scenarioRunner.on('onStart', (data) => {
      this.notifyPopup('scenarioStarted', data);
    });
    
    this.scenarioRunner.on('onComplete', (data) => {
      this.notifyPopup('scenarioCompleted', data);
    });
    
    this.scenarioRunner.on('onError', (data) => {
      this.notifyPopup('scenarioError', data);
    });
    
    this.scenarioRunner.on('onStepComplete', (data) => {
      this.notifyPopup('stepCompleted', data);
    });
  }
  
  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'executeScenario':
          await this.executeScenario(request.scenario, request.parameters);
          sendResponse({ success: true });
          break;
          
        case 'pauseScenario':
          this.scenarioRunner.pause();
          sendResponse({ success: true });
          break;
          
        case 'resumeScenario':
          this.scenarioRunner.resume();
          sendResponse({ success: true });
          break;
          
        case 'stopScenario':
          this.scenarioRunner.stop();
          sendResponse({ success: true });
          break;
          
        case 'getStatus':
          const status = this.scenarioRunner.getStatus();
          sendResponse({ status });
          break;
          
        case 'getScenarios':
          const scenarios = this.scenarioRunner.listScenarios();
          sendResponse({ scenarios });
          break;
          
        case 'updateSettings':
          await this.updateSettings(request.settings);
          sendResponse({ success: true });
          break;
          
        case 'getCurrentPage':
          const pageInfo = await this.scenarioRunner.pageDetector.detectCurrentPage();
          sendResponse({ pageInfo });
          break;
          
        default:
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ error: error.message });
    }
  }
  
  async executeScenario(scenarioName, parameters = {}) {
    if (!this.isInitialized) {
      throw new Error('Auto Browser not initialized');
    }
    
    await this.scenarioRunner.runScenario(scenarioName, parameters);
  }
  
  async updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    
    // Update scenario runner settings
    if (this.scenarioRunner) {
      this.scenarioRunner.options = {
        ...this.scenarioRunner.options,
        ...newSettings
      };
      
      this.scenarioRunner.humanSim.options = {
        ...this.scenarioRunner.humanSim.options,
        mouseSpeed: newSettings.mouseSpeed,
        typingSpeed: newSettings.typingSpeed,
        humanness: newSettings.humanness
      };
    }
    
    // Save to storage
    chrome.runtime.sendMessage({ 
      action: 'saveSettings', 
      settings: this.settings 
    });
  }
  
  notifyPopup(event, data) {
    // Send message to popup if it's open
    chrome.runtime.sendMessage({
      action: 'popupNotification',
      event: event,
      data: data
    }).catch(() => {
      // Popup might be closed, ignore error
    });
  }
}

// Initialize when content script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.speedwayAutoBrowser = new SpeedwayAutoBrowser();
  });
} else {
  window.speedwayAutoBrowser = new SpeedwayAutoBrowser();
}