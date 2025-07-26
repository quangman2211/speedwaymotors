/**
 * Popup Controller (Fixed Version)
 * Handles UI interactions and communication with content script
 */

class PopupController {
  constructor() {
    this.currentTab = null;
    this.scenarios = [];
    this.status = null;
    this.settings = {};
    this.statusUpdateInterval = null;
    this.connectionRetries = 0;
    this.maxRetries = 5;
    
    this.init();
  }
  
  async init() {
    try {
      // Show loading state
      this.showLoading('Initializing extension...');
      
      // Get current tab
      this.currentTab = await this.getCurrentTab();
      
      // Check if we're on Speedway Motors
      if (!this.currentTab.url.includes('speedwaymotors.com')) {
        this.showError('Please navigate to speedwaymotors.com first');
        this.disableControls();
        this.showNavigateButton();
        return;
      }
      
      // Initialize UI
      this.initializeElements();
      
      // Wait for content script to be ready
      await this.waitForContentScript();
      
      // Load data
      await this.loadSettings();
      await this.loadScenarios();
      await this.loadPageInfo();
      
      // Start status updates
      this.startStatusUpdates();
      
      // Setup event listeners
      this.setupEventListeners();
      
      this.hideLoading();
      this.addLog('Extension ready. Select a scenario to begin.', 'info');
      
    } catch (error) {
      console.error('Popup initialization failed:', error);
      this.hideLoading();
      this.showError('Failed to initialize: ' + error.message);
      this.showRetryButton();
    }
  }
  
  async waitForContentScript() {
    const maxWait = 10000; // 10 seconds
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      try {
        const response = await this.sendMessage('ping');
        if (response && response.success && response.initialized) {
          console.log('✅ Content script ready');
          return;
        }
      } catch (error) {
        console.log('⏳ Waiting for content script...', error.message);
      }
      
      await this.sleep(500);
    }
    
    throw new Error('Content script not responding. Please refresh the page.');
  }
  
  initializeElements() {
    this.elements = {
      // Loading
      loadingIndicator: document.getElementById('loadingIndicator'),
      
      // Scenario controls
      scenarioSelect: document.getElementById('scenarioSelect'),
      parameters: document.getElementById('parameters'),
      startBtn: document.getElementById('startBtn'),
      pauseBtn: document.getElementById('pauseBtn'),
      stopBtn: document.getElementById('stopBtn'),
      
      // Status display
      statusState: document.getElementById('statusState'),
      statusScenario: document.getElementById('statusScenario'),
      statusProgress: document.getElementById('statusProgress'),
      statusDuration: document.getElementById('statusDuration'),
      progressFill: document.getElementById('progressFill'),
      
      // Page info
      pageType: document.getElementById('pageType'),
      pageUrl: document.getElementById('pageUrl'),
      
      // Settings
      mouseSpeed: document.getElementById('mouseSpeed'),
      typingSpeed: document.getElementById('typingSpeed'),
      humanness: document.getElementById('humanness'),
      debugMode: document.getElementById('debugMode'),
      
      // Logs
      logs: document.getElementById('logs')
    };
    
    // Create loading indicator if it doesn't exist
    if (!this.elements.loadingIndicator) {
      this.createLoadingIndicator();
    }
  }
  
  createLoadingIndicator() {
    const loading = document.createElement('div');
    loading.id = 'loadingIndicator';
    loading.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.8);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: white;
      z-index: 1000;
    `;
    loading.innerHTML = `
      <div style="font-size: 16px; margin-bottom: 10px;">🔄</div>
      <div id="loadingText">Loading...</div>
    `;
    document.body.appendChild(loading);
    this.elements.loadingIndicator = loading;
  }
  
  showLoading(text = 'Loading...') {
    if (this.elements.loadingIndicator) {
      const textEl = document.getElementById('loadingText');
      if (textEl) textEl.textContent = text;
      this.elements.loadingIndicator.style.display = 'flex';
    }
  }
  
  hideLoading() {
    if (this.elements.loadingIndicator) {
      this.elements.loadingIndicator.style.display = 'none';
    }
  }
  
  setupEventListeners() {
    // Scenario selection
    this.elements.scenarioSelect?.addEventListener('change', () => {
      this.onScenarioChange();
    });
    
    // Control buttons
    this.elements.startBtn?.addEventListener('click', () => {
      this.startScenario();
    });
    
    this.elements.pauseBtn?.addEventListener('click', () => {
      this.pauseScenario();
    });
    
    this.elements.stopBtn?.addEventListener('click', () => {
      this.stopScenario();
    });
    
    // Settings controls
    this.setupSettingListener('mouseSpeed', 'mouseSpeedValue', (val) => `${val}x`);
    this.setupSettingListener('typingSpeed', 'typingSpeedValue', (val) => `${val}x`);
    this.setupSettingListener('humanness', 'humannessValue', (val) => val.toString());
    
    this.elements.debugMode?.addEventListener('change', (e) => {
      this.updateSetting('debug', e.target.checked);
    });
    
    // Listen for notifications from content script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'popupNotification') {
        this.handleNotification(request.event, request.data);
      }
    });
    
    // Handle popup visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.refreshStatus();
      }
    });
  }
  
  setupSettingListener(settingId, valueId, formatter) {
    const element = this.elements[settingId];
    const valueElement = document.getElementById(valueId);
    
    if (element && valueElement) {
      element.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        valueElement.textContent = formatter(value.toFixed(1));
        this.updateSetting(settingId, value);
      });
    }
  }
  
  async getCurrentTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
  }
  
  async sendMessage(action, data = {}) {
    return new Promise((resolve, reject) => {
      if (!this.currentTab) {
        reject(new Error('No active tab'));
        return;
      }
      
      const timeout = setTimeout(() => {
        reject(new Error('Message timeout'));
      }, 5000);
      
      chrome.tabs.sendMessage(this.currentTab.id, { action, ...data }, (response) => {
        clearTimeout(timeout);
        
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response || {});
        }
      });
    });
  }
  
  async loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
      this.settings = {
        mouseSpeed: 1.0,
        typingSpeed: 1.0,
        humanness: 0.8,
        debug: false,
        ...response.settings
      };
      
      // Update UI elements
      if (this.elements.mouseSpeed) {
        this.elements.mouseSpeed.value = this.settings.mouseSpeed;
        this.elements.typingSpeed.value = this.settings.typingSpeed;
        this.elements.humanness.value = this.settings.humanness;
        this.elements.debugMode.checked = this.settings.debug;
        
        // Update value displays
        const mouseSpeedValue = document.getElementById('mouseSpeedValue');
        const typingSpeedValue = document.getElementById('typingSpeedValue');
        const humannessValue = document.getElementById('humannessValue');
        
        if (mouseSpeedValue) mouseSpeedValue.textContent = `${this.settings.mouseSpeed.toFixed(1)}x`;
        if (typingSpeedValue) typingSpeedValue.textContent = `${this.settings.typingSpeed.toFixed(1)}x`;
        if (humannessValue) humannessValue.textContent = this.settings.humanness.toFixed(1);
      }
      
    } catch (error) {
      console.warn('Failed to load settings:', error);
      this.settings = {
        mouseSpeed: 1.0,
        typingSpeed: 1.0,
        humanness: 0.8,
        debug: false
      };
    }
  }
  
  async loadScenarios() {
    try {
      const response = await this.sendMessage('getScenarios');
      this.scenarios = response.scenarios || [];
      
      // Populate scenario select
      if (this.elements.scenarioSelect) {
        this.elements.scenarioSelect.innerHTML = '<option value="">Select a scenario...</option>';
        
        this.scenarios.forEach(scenario => {
          const option = document.createElement('option');
          option.value = scenario.name;
          option.textContent = scenario.description || scenario.name;
          this.elements.scenarioSelect.appendChild(option);
        });
      }
      
      if (this.scenarios.length === 0) {
        this.addLog('No scenarios available. Content script may not be loaded.', 'warn');
      } else {
        this.addLog(`Loaded ${this.scenarios.length} scenarios.`, 'success');
      }
      
    } catch (error) {
      this.addLog('Failed to load scenarios: ' + error.message, 'error');
      this.scenarios = [];
    }
  }
  
  async loadPageInfo() {
    try {
      const response = await this.sendMessage('getCurrentPage');
      const pageInfo = response.pageInfo;
      
      if (pageInfo && this.elements.pageType && this.elements.pageUrl) {
        this.elements.pageType.textContent = pageInfo.type.toUpperCase();
        this.elements.pageUrl.textContent = this.truncateUrl(pageInfo.pathname || pageInfo.url);
        
        // Color-code page types
        const colors = {
          homepage: '#4CAF50',
          search: '#2196F3',
          product: '#FF9800',
          category: '#9C27B0',
          cart: '#f44336',
          checkout: '#795548',
          account: '#607D8B'
        };
        
        this.elements.pageType.style.background = colors[pageInfo.type] || 'rgba(255,255,255,0.2)';
        this.addLog(`Detected page: ${pageInfo.type}`, 'info');
      } else {
        if (this.elements.pageType) this.elements.pageType.textContent = 'UNKNOWN';
        if (this.elements.pageUrl) this.elements.pageUrl.textContent = 'Detection failed';
      }
      
    } catch (error) {
      console.warn('Failed to load page info:', error);
      if (this.elements.pageType) this.elements.pageType.textContent = 'ERROR';
      if (this.elements.pageUrl) this.elements.pageUrl.textContent = error.message;
    }
  }
  
  onScenarioChange() {
    const scenarioName = this.elements.scenarioSelect?.value;
    const scenario = this.scenarios.find(s => s.name === scenarioName);
    
    // Clear existing parameters
    if (this.elements.parameters) {
      this.elements.parameters.innerHTML = '';
    }
    
    if (scenario && scenario.parameters && this.elements.parameters) {
      Object.entries(scenario.parameters).forEach(([paramName, paramConfig]) => {
        const paramDiv = document.createElement('div');
        paramDiv.className = 'parameter';
        
        const label = document.createElement('label');
        label.textContent = this.formatParameterName(paramName);
        if (paramConfig.required) {
          label.textContent += ' *';
        }
        
        const input = document.createElement('input');
        input.type = paramConfig.type === 'number' ? 'number' : 'text';
        input.id = `param-${paramName}`;
        input.placeholder = paramConfig.default ? `Default: ${paramConfig.default}` : 'Enter value...';
        input.value = paramConfig.default || '';
        
        if (paramConfig.type === 'number') {
          input.min = paramConfig.min || 0;
          input.max = paramConfig.max || 999;
          input.step = paramConfig.step || 1;
        }
        
        paramDiv.appendChild(label);
        paramDiv.appendChild(input);
        this.elements.parameters.appendChild(paramDiv);
      });
      
      this.addLog(`Selected scenario: ${scenario.description || scenarioName}`, 'info');
    }
  }
  
  async startScenario() {
    const scenarioName = this.elements.scenarioSelect?.value;
    if (!scenarioName) {
      this.showError('Please select a scenario');
      return;
    }
    
    // Collect parameters
    const parameters = {};
    const scenario = this.scenarios.find(s => s.name === scenarioName);
    
    if (scenario && scenario.parameters) {
      for (const [paramName, paramConfig] of Object.entries(scenario.parameters)) {
        const input = document.getElementById(`param-${paramName}`);
        if (input) {
          const value = input.value.trim();
          
          if (paramConfig.required && !value) {
            this.showError(`Parameter "${this.formatParameterName(paramName)}" is required`);
            input.focus();
            return;
          }
          
          if (value) {
            if (paramConfig.type === 'number') {
              const numValue = parseFloat(value);
              if (isNaN(numValue)) {
                this.showError(`Parameter "${paramName}" must be a number`);
                input.focus();
                return;
              }
              parameters[paramName] = numValue;
            } else if (paramConfig.type === 'array') {
              parameters[paramName] = value.split(',').map(s => s.trim());
            } else {
              parameters[paramName] = value;
            }
          }
        }
      }
    }
    
    // Start scenario
    try {
      this.addLog(`🚀 Starting scenario: ${scenarioName}`, 'info');
      this.updateControls(true);
      
      const response = await this.sendMessage('executeScenario', {
        scenario: scenarioName,
        parameters: parameters
      });
      
      if (response.success) {
        this.addLog('✅ Scenario started successfully', 'success');
      } else {
        throw new Error(response.error || 'Failed to start scenario');
      }
      
    } catch (error) {
      this.showError('Failed to start scenario: ' + error.message);
      this.updateControls(false);
    }
  }
  
  async pauseScenario() {
    try {
      const response = await this.sendMessage('pauseScenario');
      if (response.success) {
        this.addLog('⏸️ Scenario paused', 'info');
      } else {
        this.showError('Failed to pause scenario');
      }
    } catch (error) {
      this.showError('Failed to pause: ' + error.message);
    }
  }
  
  async stopScenario() {
    try {
      const response = await this.sendMessage('stopScenario');
      if (response.success) {
        this.addLog('⏹️ Scenario stopped', 'info');
        this.updateControls(false);
      } else {
        this.showError('Failed to stop scenario');
      }
    } catch (error) {
      this.showError('Failed to stop: ' + error.message);
    }
  }
  
  async updateSetting(key, value) {
    this.settings[key] = value;
    
    try {
      await this.sendMessage('updateSettings', this.settings);
    } catch (error) {
      console.warn('Failed to update settings:', error);
    }
  }
  
  updateControls(isRunning) {
    if (this.elements.startBtn) this.elements.startBtn.disabled = isRunning;
    if (this.elements.pauseBtn) this.elements.pauseBtn.disabled = !isRunning;
    if (this.elements.stopBtn) this.elements.stopBtn.disabled = !isRunning;
    if (this.elements.scenarioSelect) this.elements.scenarioSelect.disabled = isRunning;
    
    // Disable parameter inputs
    if (this.elements.parameters) {
      const paramInputs = this.elements.parameters.querySelectorAll('input');
      paramInputs.forEach(input => {
        input.disabled = isRunning;
      });
    }
  }
  
  disableControls() {
    if (this.elements.startBtn) this.elements.startBtn.disabled = true;
    if (this.elements.pauseBtn) this.elements.pauseBtn.disabled = true;
    if (this.elements.stopBtn) this.elements.stopBtn.disabled = true;
    if (this.elements.scenarioSelect) this.elements.scenarioSelect.disabled = true;
  }
  
  showNavigateButton() {
    const navigateBtn = document.createElement('button');
    navigateBtn.className = 'btn btn-primary';
    navigateBtn.textContent = '🌐 Go to Speedway Motors';
    navigateBtn.onclick = () => {
      chrome.tabs.create({ url: 'https://www.speedwaymotors.com/' });
      window.close();
    };
    
    const controls = document.querySelector('.controls');
    if (controls) {
      controls.innerHTML = '';
      controls.appendChild(navigateBtn);
    }
  }
  
  showRetryButton() {
    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn btn-secondary';
    retryBtn.textContent = '🔄 Retry';
    retryBtn.onclick = () => {
      window.location.reload();
    };
    
    const controls = document.querySelector('.controls');
    if (controls) {
      controls.appendChild(retryBtn);
    }
  }
  
  startStatusUpdates() {
    // Update immediately
    this.refreshStatus();
    
    // Then update every 2 seconds
    this.statusUpdateInterval = setInterval(() => {
      this.refreshStatus();
    }, 2000);
  }
  
  async refreshStatus() {
    try {
      const response = await this.sendMessage('getStatus');
      if (response.status) {
        this.updateStatus(response.status);
      }
    } catch (error) {
      // Ignore status update errors to prevent spam
      console.debug('Status update failed:', error.message);
    }
  }
  
  updateStatus(status) {
    this.status = status;
    
    if (!this.elements.statusState) return;
    
    // Update status display
    let stateText = 'Idle';
    let stateClass = 'status-idle';
    
    if (status.isRunning) {
      if (status.isPaused) {
        stateText = 'Paused';
        stateClass = 'status-paused';
      } else {
        stateText = 'Running';
        stateClass = 'status-running';
      }
    }
    
    this.elements.statusState.textContent = stateText;
    this.elements.statusState.className = stateClass;
    
    if (this.elements.statusScenario) {
      this.elements.statusScenario.textContent = status.currentScenario || 'None';
    }
    if (this.elements.statusProgress) {
      this.elements.statusProgress.textContent = `${status.currentStep}/${status.totalSteps}`;
    }
    if (this.elements.statusDuration) {
      this.elements.statusDuration.textContent = `${Math.round(status.duration / 1000)}s`;
    }
    
    // Update progress bar
    if (this.elements.progressFill) {
      const progressPercent = status.totalSteps > 0 ? 
        (status.currentStep / status.totalSteps) * 100 : 0;
      this.elements.progressFill.style.width = `${progressPercent}%`;
    }
    
    // Update controls based on status
    if (!status.isRunning) {
      this.updateControls(false);
    }
  }
  
  handleNotification(event, data) {
    switch (event) {
      case 'scenarioStarted':
        this.addLog(`✅ Scenario started: ${data.scenario}`, 'success');
        this.updateControls(true);
        break;
        
      case 'scenarioCompleted':
        const duration = Math.round(data.duration / 1000);
        this.addLog(`🎉 Scenario completed in ${duration}s`, 'success');
        this.updateControls(false);
        break;
        
      case 'scenarioError':
        this.addLog(`❌ Error: ${data.error}`, 'error');
        this.updateControls(false);
        break;
        
      case 'stepCompleted':
        this.addLog(`📍 Step ${data.step} completed`, 'info');
        break;
        
      case 'stepStarted':
        this.addLog(`▶️ Starting step ${data.step}: ${data.action?.name || 'Action'}`, 'info');
        break;
    }
  }
  
  addLog(message, type = 'info') {
    if (!this.elements.logs) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = `${timestamp}: ${message}`;
    
    this.elements.logs.appendChild(logEntry);
    this.elements.logs.scrollTop = this.elements.logs.scrollHeight;
    
    // Keep only last 50 log entries
    while (this.elements.logs.children.length > 50) {
      this.elements.logs.removeChild(this.elements.logs.firstChild);
    }
  }
  
  showError(message) {
    this.addLog(`❌ Error: ${message}`, 'error');
    
    // Show visual feedback
    if (this.elements.startBtn) {
      const originalBg = this.elements.startBtn.style.background;
      this.elements.startBtn.style.background = '#f44336';
      setTimeout(() => {
        this.elements.startBtn.style.background = originalBg;
      }, 2000);
    }
  }
  
  // Utility methods
  formatParameterName(paramName) {
    return paramName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  }
  
  truncateUrl(url) {
    if (!url) return '';
    return url.length > 30 ? url.substring(0, 30) + '...' : url;
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Cleanup when popup closes
  destroy() {
    if (this.statusUpdateInterval) {
      clearInterval(this.statusUpdateInterval);
    }
  }
}

// Global error handler
window.addEventListener('error', (event) => {
  console.error('Popup error:', event.error);
});

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.popupController = new PopupController();
});

// Cleanup when popup closes
window.addEventListener('beforeunload', () => {
  if (window.popupController) {
    window.popupController.destroy();
  }
});