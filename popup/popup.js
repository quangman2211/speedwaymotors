/**
 * Popup Controller
 * Handles UI interactions and communication with content script
 */

class PopupController {
  constructor() {
    this.currentTab = null;
    this.scenarios = [];
    this.status = null;
    this.settings = {};
    this.statusUpdateInterval = null;
    
    this.init();
  }
  
  async init() {
    try {
      // Get current tab
      this.currentTab = await this.getCurrentTab();
      
      // Check if we're on Speedway Motors
      if (!this.currentTab.url.includes('speedwaymotors.com')) {
        this.showError('Please navigate to speedwaymotors.com first');
        this.disableControls();
        return;
      }
      
      // Initialize UI
      this.initializeElements();
      await this.loadSettings();
      await this.loadScenarios();
      await this.loadPageInfo();
      this.startStatusUpdates();
      
      // Setup event listeners
      this.setupEventListeners();
      
      this.addLog('Extension ready. Select a scenario to begin.', 'info');
      
    } catch (error) {
      console.error('Popup initialization failed:', error);
      this.showError('Failed to initialize extension');
    }
  }
  
  initializeElements() {
    this.elements = {
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
  }
  
  setupEventListeners() {
    // Scenario selection
    this.elements.scenarioSelect.addEventListener('change', () => {
      this.onScenarioChange();
    });
    
    // Control buttons
    this.elements.startBtn.addEventListener('click', () => {
      this.startScenario();
    });
    
    this.elements.pauseBtn.addEventListener('click', () => {
      this.pauseScenario();
    });
    
    this.elements.stopBtn.addEventListener('click', () => {
      this.stopScenario();
    });
    
    // Settings controls
    this.setupSettingListener('mouseSpeed', 'mouseSpeedValue', (val) => `${val}x`);
    this.setupSettingListener('typingSpeed', 'typingSpeedValue', (val) => `${val}x`);
    this.setupSettingListener('humanness', 'humannessValue', (val) => val.toString());
    
    this.elements.debugMode.addEventListener('change', (e) => {
      this.updateSetting('debug', e.target.checked);
    });
    
    // Listen for notifications from content script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'popupNotification') {
        this.handleNotification(request.event, request.data);
      }
    });
    
    // Handle popup close/open
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.refreshStatus();
      }
    });
  }
  
  setupSettingListener(settingId, valueId, formatter) {
    const element = this.elements[settingId];
    const valueElement = document.getElementById(valueId);
    
    element.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      valueElement.textContent = formatter(value.toFixed(1));
      this.updateSetting(settingId, value);
    });
  }
  
  async getCurrentTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
  }
  
  async sendMessage(action, data = {}) {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(this.currentTab.id, { action, ...data }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Message error:', chrome.runtime.lastError);
          resolve({ error: chrome.runtime.lastError.message });
        } else {
          resolve(response || {});
        }
      });
    });
  }
  
  async loadSettings() {
    const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
    this.settings = {
      mouseSpeed: 1.0,
      typingSpeed: 1.0,
      humanness: 0.8,
      debug: false,
      ...response.settings
    };
    
    // Update UI elements
    this.elements.mouseSpeed.value = this.settings.mouseSpeed;
    this.elements.typingSpeed.value = this.settings.typingSpeed;
    this.elements.humanness.value = this.settings.humanness;
    this.elements.debugMode.checked = this.settings.debug;
    
    // Update value displays
    document.getElementById('mouseSpeedValue').textContent = `${this.settings.mouseSpeed.toFixed(1)}x`;
    document.getElementById('typingSpeedValue').textContent = `${this.settings.typingSpeed.toFixed(1)}x`;
    document.getElementById('humannessValue').textContent = this.settings.humanness.toFixed(1);
  }
  
  async loadScenarios() {
    const response = await this.sendMessage('getScenarios');
    
    if (response.error) {
      this.showError('Failed to load scenarios: ' + response.error);
      return;
    }
    
    this.scenarios = response.scenarios || [];
    
    // Populate scenario select
    this.elements.scenarioSelect.innerHTML = '<option value="">Select a scenario...</option>';
    
    this.scenarios.forEach(scenario => {
      const option = document.createElement('option');
      option.value = scenario.name;
      option.textContent = scenario.description || scenario.name;
      this.elements.scenarioSelect.appendChild(option);
    });
    
    if (this.scenarios.length === 0) {
      this.addLog('No scenarios available. Check content script loading.', 'warn');
    } else {
      this.addLog(`Loaded ${this.scenarios.length} scenarios.`, 'success');
    }
  }
  
  async loadPageInfo() {
    const response = await this.sendMessage('getCurrentPage');
    
    if (response.error) {
      this.elements.pageType.textContent = 'ERROR';
      this.elements.pageUrl.textContent = response.error;
      return;
    }
    
    const pageInfo = response.pageInfo;
    
    if (pageInfo) {
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
      this.elements.pageType.textContent = 'UNKNOWN';
      this.elements.pageUrl.textContent = 'Page detection failed';
    }
  }
  
  onScenarioChange() {
    const scenarioName = this.elements.scenarioSelect.value;
    const scenario = this.scenarios.find(s => s.name === scenarioName);
    
    // Clear existing parameters
    this.elements.parameters.innerHTML = '';
    
    if (scenario && scenario.parameters) {
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
    const scenarioName = this.elements.scenarioSelect.value;
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
    this.addLog(`🚀 Starting scenario: ${scenarioName}`, 'info');
    this.updateControls(true);
    
    const response = await this.sendMessage('executeScenario', {
      scenario: scenarioName,
      parameters: parameters
    });
    
    if (response.error) {
      this.showError(response.error);
      this.updateControls(false);
    } else {
      this.addLog('✅ Scenario started successfully', 'success');
    }
  }
  
  async pauseScenario() {
    const response = await this.sendMessage('pauseScenario');
    if (response.success) {
      this.addLog('⏸️ Scenario paused', 'info');
    } else {
      this.showError('Failed to pause scenario');
    }
  }
  
  async stopScenario() {
    const response = await this.sendMessage('stopScenario');
    if (response.success) {
      this.addLog('⏹️ Scenario stopped', 'info');
      this.updateControls(false);
    } else {
      this.showError('Failed to stop scenario');
    }
  }
  
  async updateSetting(key, value) {
    this.settings[key] = value;
    
    const response = await this.sendMessage('updateSettings', this.settings);
    if (response.error) {
      console.error('Failed to update settings:', response.error);
    }
  }
  
  updateControls(isRunning) {
    this.elements.startBtn.disabled = isRunning;
    this.elements.pauseBtn.disabled = !isRunning;
    this.elements.stopBtn.disabled = !isRunning;
    this.elements.scenarioSelect.disabled = isRunning;
    
    // Disable parameter inputs
    const paramInputs = this.elements.parameters.querySelectorAll('input');
    paramInputs.forEach(input => {
      input.disabled = isRunning;
    });
  }
  
  disableControls() {
    this.elements.startBtn.disabled = true;
    this.elements.pauseBtn.disabled = true;
    this.elements.stopBtn.disabled = true;
    this.elements.scenarioSelect.disabled = true;
  }
  
  startStatusUpdates() {
    // Update immediately
    this.refreshStatus();
    
    // Then update every second
    this.statusUpdateInterval = setInterval(() => {
      this.refreshStatus();
    }, 1000);
  }
  
  async refreshStatus() {
    const response = await this.sendMessage('getStatus');
    if (response.status) {
      this.updateStatus(response.status);
    }
  }
  
  updateStatus(status) {
    this.status = status;
    
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
    
    this.elements.statusScenario.textContent = status.currentScenario || 'None';
    this.elements.statusProgress.textContent = `${status.currentStep}/${status.totalSteps}`;
    this.elements.statusDuration.textContent = `${Math.round(status.duration / 1000)}s`;
    
    // Update progress bar
    const progressPercent = status.totalSteps > 0 ? 
      (status.currentStep / status.totalSteps) * 100 : 0;
    this.elements.progressFill.style.width = `${progressPercent}%`;
    
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
    this.elements.startBtn.style.background = '#f44336';
    setTimeout(() => {
      this.elements.startBtn.style.background = '';
    }, 2000);
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