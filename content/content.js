// ============================================================================
// CONTENT.JS - Main Content Script - Improved Version
// ============================================================================

console.log('[Speedway] Enhanced content script loading...');

class SpeedwayAutoBrowser {
  constructor() {
    // Singleton pattern
    if (SpeedwayAutoBrowser.instance) {
      console.log('[Speedway] Returning existing instance');
      return SpeedwayAutoBrowser.instance;
    }
    
    SpeedwayAutoBrowser.instance = this;
    
    // Core properties
    this.scenarioRunner = null;
    this.isInitialized = false;
    this.isInitializing = false;
    this.settings = {};
    this.initializationAttempts = 0;
    this.maxInitAttempts = 5;
    
    // State management
    this.state = {
      ready: false,
      error: null,
      lastActivity: Date.now(),
      messageQueue: [],
      eventListeners: new Map(),
      cleanupTasks: []
    };
    
    // Performance tracking
    this.performance = {
      initStart: Date.now(),
      initEnd: null,
      messageCount: 0,
      errorCount: 0,
      avgResponseTime: 0
    };
    
    // Module health tracking
    this.moduleHealth = {
      humanSim: 'unknown',
      pageDetector: 'unknown',
      scenarioRunner: 'unknown'
    };
    
    // Communication state
    this.communicationState = {
      connected: false,
      lastPing: null,
      reconnectAttempts: 0,
      maxReconnectAttempts: 3
    };
    
    // Initialize with enhanced error handling
    this.safeInit();
  }
  
  async safeInit() {
    try {
      await this.init();
    } catch (error) {
      console.error('[Speedway] Safe initialization failed:', error);
      this.handleCriticalError(error);
    }
  }
  
  async init() {
    // Prevent concurrent initialization
    if (this.isInitializing) {
      console.log('[Speedway] Initialization already in progress');
      return this.waitForInitialization();
    }
    
    if (this.isInitialized) {
      console.log('[Speedway] Already initialized');
      return;
    }
    
    this.isInitializing = true;
    this.initializationAttempts++;
    
    console.log(`[Speedway] Starting initialization attempt ${this.initializationAttempts}`);
    
    try {
      // Enhanced dependency loading
      await this.loadDependenciesWithRetry();
      
      // Load settings with fallback
      await this.loadSettingsWithFallback();
      
      // Initialize modules with health checks
      await this.initializeModulesWithHealthCheck();
      
      // Setup communication
      await this.setupEnhancedCommunication();
      
      // Setup lifecycle management
      this.setupLifecycleManagement();
      
      // Setup performance monitoring
      this.setupPerformanceMonitoring();
      
      // Mark as initialized
      this.isInitialized = true;
      this.isInitializing = false;
      this.state.ready = true;
      this.performance.initEnd = Date.now();
      
      const initDuration = this.performance.initEnd - this.performance.initStart;
      console.log(`✅ [Speedway] Enhanced Auto Browser initialized successfully in ${initDuration}ms`);
      
      // Process queued messages
      await this.processMessageQueue();
      
      // Initial page detection
      setTimeout(() => this.performInitialPageDetection(), 1000);
      
      // Send ready signal
      this.notifyReady();
      
    } catch (error) {
      this.isInitializing = false;
      await this.handleInitializationError(error);
    }
  }
  
  async waitForInitialization() {
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.isInitializing && Date.now() - startTime < timeout) {
      await this.sleep(100);
    }
    
    if (!this.isInitialized) {
      throw new Error('Initialization timeout or failed');
    }
  }
  
  async loadDependenciesWithRetry() {
    const maxRetries = 3;
    const dependencies = ['HumanSimulator', 'PageDetector', 'ScenarioRunner'];
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Speedway] Loading dependencies (attempt ${attempt}/${maxRetries})`);
        
        await this.waitForDependencies();
        
        // Verify all dependencies are working
        for (const dep of dependencies) {
          if (typeof window[dep] !== 'function') {
            throw new Error(`${dep} is not a constructor function`);
          }
          
          // Quick health check
          try {
            const instance = new window[dep]({ debug: false });
            if (instance.destroy) {
              instance.destroy();
            }
          } catch (error) {
            throw new Error(`${dep} constructor failed: ${error.message}`);
          }
        }
        
        console.log('[Speedway] All dependencies loaded and verified');
        return;
        
      } catch (error) {
        console.warn(`[Speedway] Dependency loading attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          await this.sleep(1000 * attempt); // Exponential backoff
        } else {
          throw new Error(`Failed to load dependencies after ${maxRetries} attempts: ${error.message}`);
        }
      }
    }
  }
  
  async waitForDependencies() {
    const maxWait = 15000; // 15 seconds
    const checkInterval = 200;
    const startTime = Date.now();
    
    const requiredDeps = ['HumanSimulator', 'PageDetector', 'ScenarioRunner'];
    
    while (Date.now() - startTime < maxWait) {
      const missing = requiredDeps.filter(dep => typeof window[dep] === 'undefined');
      
      if (missing.length === 0) {
        return;
      }
      
      // Log missing dependencies periodically
      if ((Date.now() - startTime) % 2000 < checkInterval) {
        console.log('[Speedway] Waiting for dependencies:', missing.join(', '));
      }
      
      await this.sleep(checkInterval);
    }
    
    const stillMissing = requiredDeps.filter(dep => typeof window[dep] === 'undefined');
    throw new Error(`Dependencies not loaded within timeout: ${stillMissing.join(', ')}`);
  }
  
  async loadSettingsWithFallback() {
    try {
      await this.loadSettings();
    } catch (error) {
      console.warn('[Speedway] Failed to load settings, using defaults:', error);
      this.settings = this.getDefaultSettings();
    }
  }
  
  getDefaultSettings() {
    return {
      mouseSpeed: 1.0,
      typingSpeed: 1.0,
      humanness: 0.8,
      debug: false,
      autoStart: false,
      version: '1.0.0'
    };
  }
  
  async loadSettings() {
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.runtime) {
        // Fallback for testing environment
        this.settings = this.getDefaultSettings();
        resolve();
        return;
      }
      
      const timeout = setTimeout(() => {
        reject(new Error('Settings loading timeout'));
      }, 5000);
      
      chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
        clearTimeout(timeout);
        
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          this.settings = {
            ...this.getDefaultSettings(),
            ...response.settings
          };
          
          console.log('[Speedway] Settings loaded:', Object.keys(this.settings));
          resolve();
        }
      });
    });
  }
  
  async initializeModulesWithHealthCheck() {
    console.log('[Speedway] Initializing modules with health checks...');
    
    try {
      // Initialize PageDetector first
      this.pageDetector = new PageDetector({ 
        debug: this.settings.debug 
      });
      
      await this.verifyModuleHealth('pageDetector', this.pageDetector);
      this.moduleHealth.pageDetector = 'healthy';
      
      // Initialize HumanSimulator
      this.humanSim = new HumanSimulator({ 
        debug: this.settings.debug,
        mouseSpeed: this.settings.mouseSpeed,
        typingSpeed: this.settings.typingSpeed,
        humanness: this.settings.humanness
      });
      
      await this.verifyModuleHealth('humanSim', this.humanSim);
      this.moduleHealth.humanSim = 'healthy';
      
      // Initialize ScenarioRunner
      this.scenarioRunner = new ScenarioRunner({
        debug: this.settings.debug,
        mouseSpeed: this.settings.mouseSpeed,
        typingSpeed: this.settings.typingSpeed,
        humanness: this.settings.humanness
      });
      
      await this.verifyModuleHealth('scenarioRunner', this.scenarioRunner);
      this.moduleHealth.scenarioRunner = 'healthy';
      
      console.log('[Speedway] All modules initialized and health-checked');
      
    } catch (error) {
      throw new Error(`Module initialization failed: ${error.message}`);
    }
  }
  
  async verifyModuleHealth(moduleName, moduleInstance) {
    try {
      // Basic instance check
      if (!moduleInstance) {
        throw new Error(`${moduleName} instance is null`);
      }
      
      // Check required methods
      const requiredMethods = {
        pageDetector: ['detectCurrentPage', 'getElement'],
        humanSim: ['humanClick', 'humanType'],
        scenarioRunner: ['runScenario', 'getStatus']
      };
      
      const methods = requiredMethods[moduleName] || [];
      for (const method of methods) {
        if (typeof moduleInstance[method] !== 'function') {
          throw new Error(`${moduleName} missing required method: ${method}`);
        }
      }
      
      // Functional health check
      switch (moduleName) {
        case 'pageDetector':
          // Quick page detection test
          await moduleInstance.detectCurrentPage();
          break;
          
        case 'humanSim':
          // Check if mouse position can be retrieved
          const position = moduleInstance.getPosition ? moduleInstance.getPosition() : { x: 0, y: 0 };
          if (typeof position.x !== 'number' || typeof position.y !== 'number') {
            throw new Error('HumanSim position tracking invalid');
          }
          break;
          
        case 'scenarioRunner':
          // Check if scenarios are available
          const scenarios = moduleInstance.listScenarios();
          if (!Array.isArray(scenarios) || scenarios.length === 0) {
            throw new Error('ScenarioRunner has no available scenarios');
          }
          break;
      }
      
      console.log(`[Speedway] ${moduleName} health check passed`);
      
    } catch (error) {
      this.moduleHealth[moduleName] = 'unhealthy';
      throw new Error(`${moduleName} health check failed: ${error.message}`);
    }
  }
  
  async setupEnhancedCommunication() {
    console.log('[Speedway] Setting up enhanced communication...');
    
    // Setup message listener with enhanced routing
    this.messageListener = (request, sender, sendResponse) => {
      this.handleMessageWithRouting(request, sender, sendResponse);
      return true; // Keep channel open for async
    };
    
    chrome.runtime.onMessage.addListener(this.messageListener);
    this.state.eventListeners.set('message', this.messageListener);
    
    // Setup scenario event forwarding
    this.setupScenarioEventForwarding();
    
    // Setup heartbeat for connection monitoring
    this.setupHeartbeat();
    
    // Test initial communication
    await this.testCommunication();
  }
  
  setupScenarioEventForwarding() {
    if (!this.scenarioRunner) return;
    
    const events = ['onStart', 'onComplete', 'onError', 'onStepComplete', 'onStepStart'];
    
    events.forEach(event => {
      const handler = (data) => this.forwardScenarioEvent(event, data);
      this.scenarioRunner.on(event, handler);
      
      // Track for cleanup
      this.state.cleanupTasks.push(() => {
        this.scenarioRunner.off(event, handler);
      });
    });
  }
  
  forwardScenarioEvent(event, data) {
    try {
      this.notifyPopup(event.replace('on', '').toLowerCase(), data);
    } catch (error) {
      console.warn('[Speedway] Failed to forward event:', event, error);
    }
  }
  
  setupHeartbeat() {
    const heartbeatInterval = 30000; // 30 seconds
    
    const heartbeat = setInterval(() => {
      if (this.isInitialized) {
        this.communicationState.lastPing = Date.now();
        
        // Optional: Send heartbeat to background
        this.sendMessage({ action: 'heartbeat' }).catch(() => {
          // Ignore heartbeat failures
        });
      }
    }, heartbeatInterval);
    
    this.state.cleanupTasks.push(() => clearInterval(heartbeat));
  }
  
  async testCommunication() {
    try {
      const response = await this.sendMessage({ action: 'ping' });
      if (response.pong) {
        this.communicationState.connected = true;
        console.log('[Speedway] Communication test successful');
      }
    } catch (error) {
      console.warn('[Speedway] Communication test failed:', error);
      this.communicationState.connected = false;
    }
  }
  
  setupLifecycleManagement() {
    // Handle page visibility changes
    const visibilityHandler = () => {
      if (document.hidden) {
        this.pauseActiveOperations();
      } else {
        this.resumeActiveOperations();
      }
    };
    
    document.addEventListener('visibilitychange', visibilityHandler);
    this.state.eventListeners.set('visibilitychange', visibilityHandler);
    
    // Handle page unload
    const unloadHandler = () => {
      this.cleanup();
    };
    
    window.addEventListener('beforeunload', unloadHandler);
    this.state.eventListeners.set('beforeunload', unloadHandler);
    
    // Handle errors
    const errorHandler = (event) => {
      this.performance.errorCount++;
      console.error('[Speedway] Global error caught:', event.error);
      
      // Try to recover from errors
      this.attemptErrorRecovery(event.error);
    };
    
    window.addEventListener('error', errorHandler);
    this.state.eventListeners.set('error', errorHandler);
    
    // Handle unhandled promise rejections
    const rejectionHandler = (event) => {
      console.error('[Speedway] Unhandled promise rejection:', event.reason);
      this.attemptErrorRecovery(event.reason);
    };
    
    window.addEventListener('unhandledrejection', rejectionHandler);
    this.state.eventListeners.set('unhandledrejection', rejectionHandler);
  }
  
  setupPerformanceMonitoring() {
    // Monitor performance periodically
    const monitoringInterval = 60000; // 1 minute
    
    const monitor = setInterval(() => {
      this.updatePerformanceMetrics();
      this.checkHealthStatus();
    }, monitoringInterval);
    
    this.state.cleanupTasks.push(() => clearInterval(monitor));
  }
  
  updatePerformanceMetrics() {
    const now = Date.now();
    this.state.lastActivity = now;
    
    // Log performance stats if debug mode
    if (this.settings.debug && this.performance.messageCount > 0) {
      console.log('[Speedway] Performance stats:', {
        uptime: now - this.performance.initStart,
        messages: this.performance.messageCount,
        errors: this.performance.errorCount,
        avgResponse: this.performance.avgResponseTime,
        moduleHealth: this.moduleHealth
      });
    }
  }
  
  checkHealthStatus() {
    // Check if modules are still healthy
    Object.entries(this.moduleHealth).forEach(([module, health]) => {
      if (health === 'unhealthy') {
        console.warn(`[Speedway] Module ${module} is unhealthy`);
        // Attempt module recovery
        this.attemptModuleRecovery(module);
      }
    });
  }
  
  async attemptModuleRecovery(moduleName) {
    try {
      console.log(`[Speedway] Attempting to recover module: ${moduleName}`);
      
      // Basic recovery strategies
      switch (moduleName) {
        case 'pageDetector':
          if (this.pageDetector) {
            await this.pageDetector.detectCurrentPage();
            this.moduleHealth.pageDetector = 'healthy';
          }
          break;
          
        case 'scenarioRunner':
          if (this.scenarioRunner && this.scenarioRunner.isRunning) {
            this.scenarioRunner.stop();
          }
          this.moduleHealth.scenarioRunner = 'healthy';
          break;
      }
      
      console.log(`[Speedway] Module ${moduleName} recovery successful`);
      
    } catch (error) {
      console.error(`[Speedway] Module ${moduleName} recovery failed:`, error);
    }
  }
  
  async handleMessageWithRouting(request, sender, sendResponse) {
    const startTime = Date.now();
    this.performance.messageCount++;
    
    try {
      // Queue messages if not initialized
      if (!this.isInitialized) {
        console.log('[Speedway] Queuing message until initialization complete:', request.action);
        this.state.messageQueue.push({ request, sender, sendResponse });
        return;
      }
      
      // Route message to appropriate handler
      const response = await this.routeMessage(request, sender);
      
      // Calculate response time
      const responseTime = Date.now() - startTime;
      this.updateAverageResponseTime(responseTime);
      
      sendResponse(response);
      
    } catch (error) {
      console.error('[Speedway] Message handling error:', error);
      
      const errorResponse = {
        error: error.message,
        timestamp: Date.now(),
        action: request.action
      };
      
      sendResponse(errorResponse);
      this.performance.errorCount++;
    }
  }
  
  async routeMessage(request, sender) {
    const { action } = request;
    
    // Core action routing
    const handlers = {
      // Scenario management
      executeScenario: () => this.handleExecuteScenario(request),
      pauseScenario: () => this.handlePauseScenario(),
      resumeScenario: () => this.handleResumeScenario(),
      stopScenario: () => this.handleStopScenario(),
      
      // Status and information
      getStatus: () => this.handleGetStatus(),
      getScenarios: () => this.handleGetScenarios(),
      getCurrentPage: () => this.handleGetCurrentPage(),
      
      // Configuration
      updateSettings: () => this.handleUpdateSettings(request.settings),
      
      // Health and diagnostics
      ping: () => this.handlePing(),
      getHealth: () => this.handleGetHealth(),
      getDiagnostics: () => this.handleGetDiagnostics(),
      
      // Navigation events
      navigationCompleted: () => this.handleNavigationCompleted(request),
      
      // Maintenance
      cleanup: () => this.handleCleanup(),
      reset: () => this.handleReset()
    };
    
    const handler = handlers[action];
    if (!handler) {
      throw new Error(`Unknown action: ${action}`);
    }
    
    return await handler();
  }
  
  async processMessageQueue() {
    console.log(`[Speedway] Processing ${this.state.messageQueue.length} queued messages`);
    
    while (this.state.messageQueue.length > 0) {
      const { request, sender, sendResponse } = this.state.messageQueue.shift();
      
      try {
        await this.handleMessageWithRouting(request, sender, sendResponse);
      } catch (error) {
        console.error('[Speedway] Queued message processing failed:', error);
        sendResponse({ error: error.message });
      }
    }
  }
  
  /**
   * ENHANCED MESSAGE HANDLERS
   */
  
  async handleExecuteScenario(request) {
    if (!this.scenarioRunner) {
      throw new Error('Scenario runner not available');
    }
    
    const { scenario, parameters = {} } = request;
    
    console.log(`[Speedway] Executing scenario: ${scenario}`, parameters);
    
    try {
      await this.scenarioRunner.runScenario(scenario, parameters);
      return { success: true, timestamp: Date.now() };
    } catch (error) {
      this.moduleHealth.scenarioRunner = 'unhealthy';
      throw error;
    }
  }
  
  async handlePauseScenario() {
    if (!this.scenarioRunner) {
      throw new Error('Scenario runner not available');
    }
    
    this.scenarioRunner.pause();
    return { success: true, action: 'paused' };
  }
  
  async handleResumeScenario() {
    if (!this.scenarioRunner) {
      throw new Error('Scenario runner not available');
    }
    
    this.scenarioRunner.resume();
    return { success: true, action: 'resumed' };
  }
  
  async handleStopScenario() {
    if (!this.scenarioRunner) {
      throw new Error('Scenario runner not available');
    }
    
    this.scenarioRunner.stop();
    return { success: true, action: 'stopped' };
  }
  
  async handleGetStatus() {
    if (!this.scenarioRunner) {
      return {
        isRunning: false,
        error: 'Scenario runner not available',
        moduleHealth: this.moduleHealth
      };
    }
    
    const status = this.scenarioRunner.getStatus();
    return {
      ...status,
      moduleHealth: this.moduleHealth,
      communicationState: this.communicationState,
      uptime: Date.now() - this.performance.initStart
    };
  }
  
  async handleGetScenarios() {
    if (!this.scenarioRunner) {
      throw new Error('Scenario runner not available');
    }
    
    const scenarios = this.scenarioRunner.listScenarios();
    return { scenarios };
  }
  
  async handleGetCurrentPage() {
    if (!this.pageDetector) {
      throw new Error('Page detector not available');
    }
    
    try {
      const pageInfo = await this.pageDetector.detectCurrentPage();
      return { pageInfo };
    } catch (error) {
      this.moduleHealth.pageDetector = 'unhealthy';
      throw error;
    }
  }
  
  async handleUpdateSettings(newSettings) {
    if (!newSettings || typeof newSettings !== 'object') {
      throw new Error('Invalid settings object');
    }
    
    // Update local settings
    this.settings = { ...this.settings, ...newSettings };
    
    // Update module settings
    await this.propagateSettingsToModules(newSettings);
    
    // Save to storage
    await this.saveSettingsToStorage();
    
    return { success: true, settings: this.settings };
  }
  
  async propagateSettingsToModules(newSettings) {
    try {
      // Update ScenarioRunner
      if (this.scenarioRunner) {
        this.scenarioRunner.options = {
          ...this.scenarioRunner.options,
          ...newSettings
        };
        
        // Update HumanSimulator through ScenarioRunner
        if (this.scenarioRunner.humanSim) {
          this.scenarioRunner.humanSim.options = {
            ...this.scenarioRunner.humanSim.options,
            mouseSpeed: newSettings.mouseSpeed,
            typingSpeed: newSettings.typingSpeed,
            humanness: newSettings.humanness,
            debug: newSettings.debug
          };
        }
      }
      
      console.log('[Speedway] Settings propagated to all modules');
      
    } catch (error) {
      console.error('[Speedway] Failed to propagate settings:', error);
    }
  }
  
  async saveSettingsToStorage() {
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.runtime) {
        resolve(); // Skip if not in extension context
        return;
      }
      
      chrome.runtime.sendMessage({ 
        action: 'saveSettings', 
        settings: this.settings 
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }
  
  async handlePing() {
    return {
      pong: true,
      timestamp: Date.now(),
      initialized: this.isInitialized,
      moduleHealth: this.moduleHealth
    };
  }
  
  async handleGetHealth() {
    return {
      moduleHealth: this.moduleHealth,
      performance: this.performance,
      state: {
        ready: this.state.ready,
        lastActivity: this.state.lastActivity,
        queueSize: this.state.messageQueue.length
      },
      communication: this.communicationState
    };
  }
  
  async handleGetDiagnostics() {
    return {
      version: '1.0.0',
      userAgent: navigator.userAgent,
      url: window.location.href,
      documentReady: document.readyState,
      dependencies: {
        HumanSimulator: typeof window.HumanSimulator !== 'undefined',
        PageDetector: typeof window.PageDetector !== 'undefined',
        ScenarioRunner: typeof window.ScenarioRunner !== 'undefined'
      },
      modules: this.moduleHealth,
      performance: this.performance,
      settings: Object.keys(this.settings)
    };
  }
  
  async handleNavigationCompleted(request) {
    console.log('[Speedway] Navigation completed:', request.url);
    
    // Trigger page re-detection
    if (this.pageDetector) {
      setTimeout(() => {
        this.pageDetector.detectCurrentPage().catch(error => {
          console.warn('[Speedway] Post-navigation page detection failed:', error);
        });
      }, 1000);
    }
    
    return { acknowledged: true };
  }
  
  async handleCleanup() {
    this.cleanup();
    return { success: true, action: 'cleanup_completed' };
  }
  
  async handleReset() {
    await this.reset();
    return { success: true, action: 'reset_completed' };
  }
  
  /**
   * LIFECYCLE MANAGEMENT
   */
  
  pauseActiveOperations() {
    if (this.scenarioRunner && this.scenarioRunner.isRunning) {
      this.scenarioRunner.pause();
      console.log('[Speedway] Operations paused due to page visibility change');
    }
  }
  
  resumeActiveOperations() {
    if (this.scenarioRunner && this.scenarioRunner.isPaused) {
      this.scenarioRunner.resume();
      console.log('[Speedway] Operations resumed after page visibility change');
    }
  }
  
  async attemptErrorRecovery(error) {
    try {
      console.log('[Speedway] Attempting error recovery for:', error.message);
      
      // Basic recovery strategies
      if (error.message.includes('not found') || error.message.includes('not available')) {
        // Re-detect page
        if (this.pageDetector) {
          await this.pageDetector.detectCurrentPage();
        }
      }
      
      // Reset module health on certain errors
      if (error.message.includes('scenario') || error.message.includes('runner')) {
        this.moduleHealth.scenarioRunner = 'unknown';
      }
      
    } catch (recoveryError) {
      console.error('[Speedway] Error recovery failed:', recoveryError);
    }
  }
  
  async performInitialPageDetection() {
    try {
      if (this.pageDetector) {
        const pageInfo = await this.pageDetector.detectCurrentPage();
        console.log('[Speedway] Initial page detected:', pageInfo.type);
      }
    } catch (error) {
      console.warn('[Speedway] Initial page detection failed:', error);
    }
  }
  
  async handleInitializationError(error) {
    console.error(`[Speedway] Initialization failed (attempt ${this.initializationAttempts}):`, error);
    
    this.state.error = error;
    
    if (this.initializationAttempts < this.maxInitAttempts) {
      const delay = 2000 * this.initializationAttempts; // Exponential backoff
      console.log(`[Speedway] Retrying initialization in ${delay}ms...`);
      
      setTimeout(() => this.safeInit(), delay);
    } else {
      this.handleCriticalError(error);
    }
  }
  
  handleCriticalError(error) {
    console.error('[Speedway] Critical error - max initialization attempts reached:', error);
    
    this.state.error = error;
    this.state.ready = false;
    
    // Set up minimal error state
    this.setupErrorState();
  }
  
  setupErrorState() {
    // Minimal message handler for error state
    const errorHandler = (request, sender, sendResponse) => {
      sendResponse({
        error: 'Extension initialization failed',
        details: this.state.error?.message,
        state: 'error'
      });
    };
    
    if (chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(errorHandler);
    }
  }
  
  updateAverageResponseTime(responseTime) {
    const currentAvg = this.performance.avgResponseTime;
    const count = this.performance.messageCount;
    this.performance.avgResponseTime = 
      (currentAvg * (count - 1) + responseTime) / count;
  }
  
  async sendMessage(message) {
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.runtime) {
        reject(new Error('Chrome runtime not available'));
        return;
      }
      
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response || {});
        }
      });
    });
  }
  
  notifyPopup(event, data) {
    this.sendMessage({
      action: 'popupNotification',
      event: event,
      data: data
    }).catch(error => {
      // Popup might be closed, ignore silently
    });
  }
  
  notifyReady() {
    this.notifyPopup('ready', {
      timestamp: Date.now(),
      initDuration: this.performance.initEnd - this.performance.initStart,
      moduleHealth: this.moduleHealth
    });
  }
  
  /**
   * CLEANUP AND MAINTENANCE
   */
  
  cleanup() {
    console.log('[Speedway] Performing cleanup...');
    
    // Stop running scenarios
    if (this.scenarioRunner && this.scenarioRunner.isRunning) {
      this.scenarioRunner.stop();
    }
    
    // Remove event listeners
    this.state.eventListeners.forEach((handler, event) => {
      try {
        if (event === 'message' && chrome.runtime.onMessage) {
          chrome.runtime.onMessage.removeListener(handler);
        } else {
          document.removeEventListener(event, handler);
        }
      } catch (error) {
        console.warn(`[Speedway] Failed to remove ${event} listener:`, error);
      }
    });
    
    this.state.eventListeners.clear();
    
    // Run cleanup tasks
    this.state.cleanupTasks.forEach(task => {
      try {
        task();
      } catch (error) {
        console.warn('[Speedway] Cleanup task failed:', error);
      }
    });
    
    this.state.cleanupTasks = [];
    
    // Destroy modules
    if (this.scenarioRunner && this.scenarioRunner.destroy) {
      this.scenarioRunner.destroy();
    }
    
    if (this.pageDetector && this.pageDetector.destroy) {
      this.pageDetector.destroy();
    }
    
    if (this.humanSim && this.humanSim.destroy) {
      this.humanSim.destroy();
    }
    
    console.log('[Speedway] Cleanup completed');
  }
  
  async reset() {
    console.log('[Speedway] Performing reset...');
    
    this.cleanup();
    
    // Reset state
    this.isInitialized = false;
    this.isInitializing = false;
    this.initializationAttempts = 0;
    this.state.ready = false;
    this.state.error = null;
    this.performance.errorCount = 0;
    this.moduleHealth = {
      humanSim: 'unknown',
      pageDetector: 'unknown',
      scenarioRunner: 'unknown'
    };
    
    // Re-initialize
    await this.safeInit();
  }
  
  // Utility methods
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Public API
  getScenarioRunner() {
    return this.scenarioRunner;
  }
  
  getPageDetector() {
    return this.pageDetector;
  }
  
  getHumanSim() {
    return this.humanSim;
  }
  
  getSettings() {
    return { ...this.settings };
  }
  
  isReady() {
    return this.isInitialized && this.state.ready;
  }
  
  getPerformanceStats() {
    return { ...this.performance };
  }
  
  getModuleHealth() {
    return { ...this.moduleHealth };
  }
}

/**
 * INITIALIZATION AND EXPORT
 */

function initializeExtension() {
  // Check if we're on the target domain
  const validDomains = ['speedwaymotors.com', 'localhost'];
  const currentDomain = window.location.hostname;
  
  if (!validDomains.some(domain => currentDomain.includes(domain))) {
    console.log('[Speedway] Not on target domain:', currentDomain);
    return;
  }
  
  // Initialize based on document state
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createInstance);
  } else {
    createInstance();
  }
  
  function createInstance() {
    try {
      window.speedwayAutoBrowser = new SpeedwayAutoBrowser();
      console.log('[Speedway] Enhanced content script loaded for:', currentDomain);
    } catch (error) {
      console.error('[Speedway] Failed to create SpeedwayAutoBrowser instance:', error);
    }
  }
}

// Auto-initialize
initializeExtension();

// Export for testing and external access
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpeedwayAutoBrowser;
}

console.log('[Speedway] Enhanced content script setup completed');