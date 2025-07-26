/**
 * Scenario Runner
 * Engine để chạy các kịch bản tự động với Human Simulator và Page Detector
 * Hỗ trợ: Product Search, Category Browse, Menu Navigation, Cart Operations
 */

class ScenarioRunner {
  constructor(options = {}) {
    this.options = {
      debug: options.debug || false,
      stepTimeout: options.stepTimeout || 30000,
      retryAttempts: options.retryAttempts || 3,
      defaultDelay: options.defaultDelay || 1000,
      ...options
    };

    // Initialize core modules
    this.pageDetector = new PageDetector({ debug: this.options.debug });
    this.humanSim = new HumanSimulator({ 
      debug: this.options.debug,
      humanness: options.humanness || 0.8,
      mouseSpeed: options.mouseSpeed || 1.0,
      typingSpeed: options.typingSpeed || 1.0
    });

    // Runtime state
    this.currentScenario = null;
    this.currentStep = 0;
    this.isRunning = false;
    this.isPaused = false;
    this.executionLog = [];
    this.errors = [];
    
    // Event callbacks
    this.callbacks = {
      onStart: [],
      onComplete: [],
      onError: [],
      onStepStart: [],
      onStepComplete: [],
      onPause: [],
      onResume: []
    };

    // Built-in scenarios
    this.scenarios = this.initBuiltInScenarios();
    
    if (this.options.debug) {
      this.enableDebugMode();
    }
  }

  /**
   * MAIN EXECUTION METHODS
   */
  
  // Chạy scenario chính
  async runScenario(scenarioName, parameters = {}) {
    if (this.isRunning) {
      throw new Error('Another scenario is already running');
    }

    const scenario = this.getScenario(scenarioName);
    if (!scenario) {
      throw new Error(`Scenario '${scenarioName}' not found`);
    }

    this.currentScenario = this.prepareScenario(scenario, parameters);
    this.currentStep = 0;
    this.isRunning = true;
    this.isPaused = false;
    this.executionLog = [];
    this.errors = [];

    this.logInfo(`🚀 Starting scenario: ${scenarioName}`);
    this.emit('onStart', { scenario: scenarioName, parameters });

    try {
      await this.executeScenario();
      this.logInfo(`✅ Scenario completed successfully: ${scenarioName}`);
      this.emit('onComplete', { 
        scenario: scenarioName, 
        steps: this.currentStep,
        duration: this.getExecutionDuration()
      });
    } catch (error) {
      this.logError(`❌ Scenario failed: ${scenarioName}`, error);
      this.emit('onError', { 
        scenario: scenarioName, 
        step: this.currentStep, 
        error: error.message 
      });
      throw error;
    } finally {
      this.isRunning = false;
      this.currentScenario = null;
    }
  }

  // Execute từng step của scenario
  async executeScenario() {
    const steps = this.currentScenario.steps;
    
    for (let i = 0; i < steps.length; i++) {
      if (!this.isRunning) break;
      
      // Handle pause
      while (this.isPaused && this.isRunning) {
        await this.sleep(100);
      }
      
      this.currentStep = i;
      const step = steps[i];
      
      this.logInfo(`📍 Step ${i + 1}/${steps.length}: ${step.name}`);
      this.emit('onStepStart', { step: i + 1, total: steps.length, action: step });

      try {
        await this.executeStep(step);
        this.logSuccess(`✓ Step ${i + 1} completed`);
        this.emit('onStepComplete', { step: i + 1, action: step });
      } catch (error) {
        await this.handleStepError(step, error, i);
      }

      // Post-step delay
      if (step.delay || this.options.defaultDelay) {
        await this.sleep(step.delay || this.options.defaultDelay);
      }
    }
  }

  // Execute một step cụ thể
  async executeStep(step) {
    // Pre-step validation
    await this.validateStepPreconditions(step);
    
    switch (step.action) {
      case 'navigate':
        await this.handleNavigate(step);
        break;
      case 'click':
        await this.handleClick(step);
        break;
      case 'type':
        await this.handleType(step);
        break;
      case 'scroll':
        await this.handleScroll(step);
        break;
      case 'wait':
        await this.handleWait(step);
        break;
      case 'hover':
        await this.handleHover(step);
        break;
      case 'select':
        await this.handleSelect(step);
        break;
      case 'upload':
        await this.handleUpload(step);
        break;
      case 'verify':
        await this.handleVerify(step);
        break;
      case 'extract':
        await this.handleExtract(step);
        break;
      case 'custom':
        await this.handleCustomAction(step);
        break;
      default:
        throw new Error(`Unknown action: ${step.action}`);
    }

    // Post-step validation
    await this.validateStepResults(step);
  }

  /**
   * ACTION HANDLERS
   */
  
  async handleNavigate(step) {
    const url = this.resolveParameter(step.url);
    this.logInfo(`🔗 Navigating to: ${url}`);
    
    window.location.href = url;
    
    // Wait for navigation complete
    await this.waitForNavigation();
    
    // Verify expected page
    if (step.expectedPage) {
      const currentPage = await this.pageDetector.detectCurrentPage();
      if (currentPage.type !== step.expectedPage) {
        throw new Error(`Expected page '${step.expectedPage}', but got '${currentPage.type}'`);
      }
    }
  }

  async handleClick(step) {
    const element = await this.findElement(step);
    
    if (step.scrollToElement !== false) {
      await this.humanSim.scrollToElement(element.element);
    }
    
    await this.humanSim.humanClick(element.element, {
      doubleClick: step.doubleClick || false,
      button: step.button || 'left'
    });
    
    // Wait for potential page change or content load
    if (step.expectsNavigation) {
      await this.waitForNavigation();
    } else if (step.expectsContentChange) {
      await this.waitForContentChange();
    }
  }

  async handleType(step) {
    const element = await this.findElement(step);
    const text = this.resolveParameter(step.text);
    
    await this.humanSim.humanType(element.element, text, {
      clearFirst: step.clearFirst !== false,
      mistakeRate: step.mistakeRate || 0.02
    });
    
    // Handle enter key if specified
    if (step.pressEnter) {
      await this.humanSim.simulateKeyPress('Enter');
    }
  }

  async handleScroll(step) {
    const options = {
      direction: step.direction || 'down',
      distance: step.distance || 300,
      speed: step.speed || 'medium'
    };
    
    if (step.element) {
      const element = await this.findElement(step);
      await this.humanSim.scrollToElement(element.element, options);
    } else {
      await this.humanSim.humanScroll(options);
    }
  }

  async handleWait(step) {
    if (step.forElement) {
      await this.findElement({ selector: step.forElement }, step.timeout || 10000);
    } else if (step.forPageType) {
      await this.waitForPageType(step.forPageType);
    } else if (step.forCondition) {
      await this.waitForCondition(step.forCondition);
    } else {
      await this.sleep(step.duration || 1000);
    }
  }

  async handleHover(step) {
    const element = await this.findElement(step);
    await this.humanSim.moveMouseToElement(element.element);
    await this.sleep(step.hoverDuration || 500);
  }

  async handleSelect(step) {
    const element = await this.findElement(step);
    const value = this.resolveParameter(step.value);
    
    if (element.element.tagName.toLowerCase() === 'select') {
      element.element.value = value;
      element.element.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      // Handle custom dropdown
      await this.handleCustomDropdown(element.element, value);
    }
  }

  async handleVerify(step) {
    const element = await this.findElement(step);
    
    switch (step.verification) {
      case 'exists':
        if (!element) throw new Error(`Element not found: ${step.selector}`);
        break;
      case 'visible':
        if (!this.pageDetector.isElementVisible(element.element)) {
          throw new Error(`Element not visible: ${step.selector}`);
        }
        break;
      case 'text':
        const expectedText = this.resolveParameter(step.expectedText);
        if (!element.element.textContent.includes(expectedText)) {
          throw new Error(`Text verification failed. Expected: ${expectedText}`);
        }
        break;
      case 'value':
        const expectedValue = this.resolveParameter(step.expectedValue);
        if (element.element.value !== expectedValue) {
          throw new Error(`Value verification failed. Expected: ${expectedValue}`);
        }
        break;
    }
  }

  async handleExtract(step) {
    const element = await this.findElement(step);
    let extractedData;
    
    switch (step.extractType) {
      case 'text':
        extractedData = element.element.textContent.trim();
        break;
      case 'attribute':
        extractedData = element.element.getAttribute(step.attribute);
        break;
      case 'value':
        extractedData = element.element.value;
        break;
      case 'html':
        extractedData = element.element.innerHTML;
        break;
    }
    
    // Store extracted data
    if (step.storeAs) {
      this.setParameter(step.storeAs, extractedData);
    }
    
    return extractedData;
  }

  async handleCustomAction(step) {
    if (typeof step.handler === 'function') {
      await step.handler({
        pageDetector: this.pageDetector,
        humanSim: this.humanSim,
        scenarioRunner: this,
        step: step
      });
    } else {
      throw new Error('Custom action requires a handler function');
    }
  }

  /**
   * BUILT-IN SCENARIOS
   */
  
  initBuiltInScenarios() {
    return {
      product_search: {
        name: 'Product Search',
        description: 'Search for a product and view details',
        parameters: {
          searchTerm: { type: 'string', default: 'racing wheels', required: true }
        },
        steps: [
          {
            name: 'Navigate to homepage',
            action: 'navigate',
            url: 'https://www.speedwaymotors.com/',
            expectedPage: 'homepage',
            delay: 2000
          },
          {
            name: 'Click search bar',
            action: 'click',
            elementName: 'searchBar',
            delay: 1000
          },
          {
            name: 'Type search query',
            action: 'type',
            elementName: 'searchBar',
            text: '${searchTerm}',
            clearFirst: true,
            delay: 1000
          },
          {
            name: 'Submit search',
            action: 'click',
            elementName: 'searchButton',
            expectsNavigation: true,
            expectedPage: 'search',
            delay: 3000
          },
          {
            name: 'Wait for search results',
            action: 'wait',
            forElement: '.search-results .product-item',
            timeout: 10000,
            delay: 1000
          },
          {
            name: 'Click first product',
            action: 'click',
            selector: '.search-results .product-item:first-child a',
            expectsNavigation: true,
            expectedPage: 'product',
            delay: 2000
          }
        ]
      },

      category_browse: {
        name: 'Category Browse',
        description: 'Browse products by category',
        parameters: {
          categoryName: { type: 'string', default: 'Circle Track', required: false }
        },
        steps: [
          {
            name: 'Navigate to homepage',
            action: 'navigate',
            url: 'https://www.speedwaymotors.com/',
            expectedPage: 'homepage',
            delay: 2000
          },
          {
            name: 'Hover over category menu',
            action: 'hover',
            elementName: 'categoryMenu',
            hoverDuration: 1000,
            delay: 500
          },
          {
            name: 'Click category',
            action: 'click',
            selector: '.category-nav a[href*="circle-track"], .category-nav .circle-track',
            expectsNavigation: true,
            expectedPage: 'category',
            delay: 2000
          },
          {
            name: 'Scroll to load more products',
            action: 'scroll',
            direction: 'down',
            distance: 500,
            delay: 1500
          },
          {
            name: 'Click product from grid',
            action: 'click',
            selector: '.product-grid .product-item:nth-child(5) a, .product-item:nth-child(5) a',
            expectsNavigation: true,
            expectedPage: 'product',
            delay: 2000
          }
        ]
      },

      add_to_cart: {
        name: 'Add to Cart',
        description: 'Search for product and add to cart',
        parameters: {
          searchTerm: { type: 'string', default: 'oil filter', required: true },
          quantity: { type: 'number', default: 1, required: false }
        },
        steps: [
          {
            name: 'Search for product',
            action: 'custom',
            handler: async (context) => {
              const searchScenario = context.scenarioRunner.getScenario('product_search');
              await context.scenarioRunner.executeScenarioSteps(searchScenario.steps.slice(0, -1));
            }
          },
          {
            name: 'Click first search result',
            action: 'click',
            selector: '.search-results .product-item:first-child a',
            expectsNavigation: true,
            expectedPage: 'product',
            delay: 2000
          },
          {
            name: 'Set quantity',
            action: 'type',
            elementName: 'quantityInput',
            text: '${quantity}',
            clearFirst: true,
            delay: 500
          },
          {
            name: 'Add to cart',
            action: 'click',
            elementName: 'addToCartButton',
            expectsContentChange: true,
            delay: 2000
          },
          {
            name: 'Verify cart updated',
            action: 'verify',
            selector: '.cart-count, .cart-items-count',
            verification: 'exists',
            delay: 1000
          }
        ]
      },

      menu_navigation: {
        name: 'Menu Navigation',
        description: 'Navigate through main menu categories',
        steps: [
          {
            name: 'Navigate to homepage',
            action: 'navigate',
            url: 'https://www.speedwaymotors.com/',
            expectedPage: 'homepage',
            delay: 2000
          },
          {
            name: 'Explore navigation menu',
            action: 'custom',
            handler: async (context) => {
              const menuItems = document.querySelectorAll('.main-nav a, .category-nav a');
              const randomIndex = Math.floor(Math.random() * Math.min(menuItems.length, 5));
              
              if (menuItems[randomIndex]) {
                await context.humanSim.humanClick(menuItems[randomIndex]);
                await context.scenarioRunner.waitForNavigation();
              }
            },
            delay: 3000
          },
          {
            name: 'Scroll and explore content',
            action: 'scroll',
            direction: 'down',
            distance: Math.floor(Math.random() * 800) + 300,
            delay: 2000
          }
        ]
      },

      realistic_browsing: {
        name: 'Realistic Browsing',
        description: 'Simulate realistic user browsing behavior',
        parameters: {
          duration: { type: 'number', default: 60, required: false }, // seconds
          searchTerms: { type: 'array', default: ['brake pads', 'oil filter', 'racing seat'], required: false }
        },
        steps: [
          {
            name: 'Start browsing session',
            action: 'custom',
            handler: async (context) => {
              const duration = context.step.parameters?.duration || 60;
              const searchTerms = context.step.parameters?.searchTerms || ['brake pads', 'oil filter'];
              const endTime = Date.now() + (duration * 1000);
              
              while (Date.now() < endTime && context.scenarioRunner.isRunning) {
                const actions = ['search', 'browse_category', 'scroll', 'back'];
                const randomAction = actions[Math.floor(Math.random() * actions.length)];
                
                switch (randomAction) {
                  case 'search':
                    const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];
                    await context.scenarioRunner.performQuickSearch(term);
                    break;
                  case 'browse_category':
                    await context.scenarioRunner.browseRandomCategory();
                    break;
                  case 'scroll':
                    await context.humanSim.humanScroll({
                      distance: Math.floor(Math.random() * 500) + 200
                    });
                    break;
                  case 'back':
                    if (Math.random() > 0.7) {
                      window.history.back();
                      await context.scenarioRunner.waitForNavigation();
                    }
                    break;
                }
                
                await context.scenarioRunner.sleep(Math.floor(Math.random() * 3000) + 2000);
              }
            }
          }
        ]
      }
    };
  }

  /**
   * UTILITY METHODS
   */
  
  async findElement(step, timeout = null) {
    timeout = timeout || this.options.stepTimeout;
    
    // Try elementName first (page-specific element)
    if (step.elementName) {
      try {
        return await this.pageDetector.getElement(step.elementName);
      } catch (error) {
        this.logWarn(`Element '${step.elementName}' not found, trying fallback selector`);
      }
    }
    
    // Fallback to direct selector
    if (step.selector) {
      const element = await this.pageDetector.waitForElement(step.selector, timeout);
      if (!element) {
        throw new Error(`Element not found: ${step.selector}`);
      }
      
      return {
        element: element,
        selector: step.selector,
        visible: this.pageDetector.isElementVisible(element)
      };
    }
    
    throw new Error('No element selector provided');
  }

  async validateStepPreconditions(step) {
    // Check if required page type
    if (step.requiresPage) {
      const currentPage = await this.pageDetector.detectCurrentPage();
      if (currentPage.type !== step.requiresPage) {
        throw new Error(`Step requires '${step.requiresPage}' page, but currently on '${currentPage.type}'`);
      }
    }
    
    // Check if element should exist
    if (step.requiresElement) {
      await this.findElement({ selector: step.requiresElement });
    }
  }

  async validateStepResults(step) {
    // Verify expected page after step
    if (step.expectedPage) {
      const currentPage = await this.pageDetector.detectCurrentPage();
      if (currentPage.type !== step.expectedPage) {
        throw new Error(`Expected to be on '${step.expectedPage}' page after step, but on '${currentPage.type}'`);
      }
    }
    
    // Verify expected element exists
    if (step.expectsElement) {
      await this.findElement({ selector: step.expectsElement });
    }
  }

  async handleStepError(step, error, stepIndex) {
    this.logError(`Step ${stepIndex + 1} failed:`, error);
    
    const maxRetries = step.retryAttempts || this.options.retryAttempts;
    const currentRetries = step._retryCount || 0;
    
    if (currentRetries < maxRetries) {
      step._retryCount = currentRetries + 1;
      this.logWarn(`Retrying step ${stepIndex + 1} (attempt ${step._retryCount}/${maxRetries})`);
      
      await this.sleep(1000 * step._retryCount); // Exponential backoff
      await this.executeStep(step);
    } else {
      throw error;
    }
  }

  // Parameter resolution
  resolveParameter(value) {
    if (typeof value !== 'string') return value;
    
    return value.replace(/\$\{(\w+)\}/g, (match, paramName) => {
      return this.currentScenario.resolvedParameters[paramName] || match;
    });
  }

  setParameter(name, value) {
    if (!this.currentScenario.resolvedParameters) {
      this.currentScenario.resolvedParameters = {};
    }
    this.currentScenario.resolvedParameters[name] = value;
  }

  prepareScenario(scenario, parameters) {
    const prepared = JSON.parse(JSON.stringify(scenario)); // Deep clone
    
    // Resolve parameters
    prepared.resolvedParameters = {};
    
    if (scenario.parameters) {
      for (const [paramName, paramConfig] of Object.entries(scenario.parameters)) {
        let value = parameters[paramName];
        
        if (value === undefined) {
          if (paramConfig.required) {
            throw new Error(`Required parameter '${paramName}' not provided`);
          }
          value = paramConfig.default;
        }
        
        prepared.resolvedParameters[paramName] = value;
      }
    }
    
    return prepared;
  }

  // Navigation helpers
  async waitForNavigation() {
    const startUrl = window.location.href;
    const timeout = 10000;
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (window.location.href !== startUrl) {
        await this.sleep(500); // Allow page to settle
        return;
      }
      await this.sleep(100);
    }
  }

  async waitForPageType(expectedType) {
    const timeout = 15000;
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const currentPage = await this.pageDetector.detectCurrentPage();
      if (currentPage.type === expectedType) {
        return currentPage;
      }
      await this.sleep(500);
    }
    
    throw new Error(`Timeout waiting for page type: ${expectedType}`);
  }

  async waitForContentChange() {
    const initialContent = document.body.innerHTML;
    const timeout = 5000;
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (document.body.innerHTML !== initialContent) {
        await this.sleep(500); // Allow content to settle
        return;
      }
      await this.sleep(100);
    }
  }

  async waitForCondition(conditionFn) {
    const timeout = 10000;
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await conditionFn()) {
        return true;
      }
      await this.sleep(100);
    }
    
    return false;
  }

  // Quick action helpers
  async performQuickSearch(searchTerm) {
    try {
      const searchBar = await this.pageDetector.getElement('searchBar');
      await this.humanSim.humanClick(searchBar.element);
      await this.humanSim.humanType(searchBar.element, searchTerm, { clearFirst: true });
      
      const searchButton = await this.pageDetector.getElement('searchButton');
      await this.humanSim.humanClick(searchButton.element);
      
      await this.waitForNavigation();
    } catch (error) {
      this.logWarn('Quick search failed:', error.message);
    }
  }

  async browseRandomCategory() {
    try {
      const categoryLinks = document.querySelectorAll('.category-nav a, .main-nav a');
      if (categoryLinks.length > 0) {
        const randomLink = categoryLinks[Math.floor(Math.random() * categoryLinks.length)];
        await this.humanSim.humanClick(randomLink);
        await this.waitForNavigation();
      }
    } catch (error) {
      this.logWarn('Random category browse failed:', error.message);
    }
  }

  // Control methods
  pause() {
    if (this.isRunning && !this.isPaused) {
      this.isPaused = true;
      this.logInfo('⏸️ Scenario paused');
      this.emit('onPause');
    }
  }

  resume() {
    if (this.isRunning && this.isPaused) {
      this.isPaused = false;
      this.logInfo('▶️ Scenario resumed');
      this.emit('onResume');
    }
  }

  stop() {
    if (this.isRunning) {
      this.isRunning = false;
      this.isPaused = false;
      this.logInfo('⏹️ Scenario stopped');
      this.emit('onComplete', { stopped: true });
    }
  }

  // Scenario management
  getScenario(name) {
    return this.scenarios[name];
  }

  addScenario(name, scenario) {
    this.scenarios[name] = scenario;
  }

  listScenarios() {
    return Object.keys(this.scenarios).map(name => ({
      name: name,
      description: this.scenarios[name].description || name,
      parameters: this.scenarios[name].parameters || {}
    }));
  }

  // Event system
  on(event, callback) {
    if (this.callbacks[event]) {
      this.callbacks[event].push(callback);
    }
  }

  off(event, callback) {
    if (this.callbacks[event]) {
      const index = this.callbacks[event].indexOf(callback);
      if (index > -1) {
        this.callbacks[event].splice(index, 1);
      }
    }
  }

  emit(event, data = null) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Callback error for ${event}:`, error);
        }
      });
    }
  }

  // Status getters
  getStatus() {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      currentScenario: this.currentScenario?.name || null,
      currentStep: this.currentStep,
      totalSteps: this.currentScenario?.steps?.length || 0,
      progress: this.getProgress(),
      errors: this.errors.length,
      duration: this.getExecutionDuration()
    };
  }

  getProgress() {
    if (!this.currentScenario) return 0;
    return Math.round((this.currentStep / this.currentScenario.steps.length) * 100);
  }

  getExecutionDuration() {
    if (!this.currentScenario) return 0;
    return Date.now() - (this.currentScenario.startTime || Date.now());
  }

  // Debug and logging
  enableDebugMode() {
    this.createDebugPanel();
  }

  createDebugPanel() {
    const panel = document.createElement('div');
    panel.id = 'scenario-runner-debug';
    panel.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      width: 400px;
      max-height: 400px;
      background: rgba(0,0,0,0.9);
      color: white;
      padding: 15px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 11px;
      z-index: 999998;
      overflow-y: auto;
      border: 1px solid #333;
    `;
    document.body.appendChild(panel);
    this.debugPanel = panel;
    
    this.updateDebugPanel();
    setInterval(() => this.updateDebugPanel(), 1000);
  }

  updateDebugPanel() {
    if (!this.debugPanel) return;
    
    const status = this.getStatus();
    
    this.debugPanel.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px;">🤖 Scenario Runner Debug</div>
      <div><strong>Status:</strong> ${status.isRunning ? (status.isPaused ? 'Paused' : 'Running') : 'Idle'}</div>
      <div><strong>Scenario:</strong> ${status.currentScenario || 'None'}</div>
      <div><strong>Progress:</strong> ${status.currentStep}/${status.totalSteps} (${status.progress}%)</div>
      <div><strong>Duration:</strong> ${Math.round(status.duration / 1000)}s</div>
      <div><strong>Errors:</strong> ${status.errors}</div>
      <div style="margin-top: 10px; font-size: 10px; opacity: 0.8;">
        Recent logs: ${this.executionLog.slice(-3).map(log => log.message).join(', ')}
      </div>
    `;
  }

  logInfo(message, data = null) {
    const logEntry = { 
      level: 'info', 
      message, 
      data, 
      timestamp: new Date().toISOString() 
    };
    
    this.executionLog.push(logEntry);
    if (this.executionLog.length > 100) {
      this.executionLog.shift();
    }
    
    if (this.options.debug) {
      console.log(`[ScenarioRunner] ${message}`, data);
    }
  }

  logSuccess(message, data = null) {
    this.logInfo(`✅ ${message}`, data);
  }

  logWarn(message, data = null) {
    const logEntry = { 
      level: 'warn', 
      message, 
      data, 
      timestamp: new Date().toISOString() 
    };
    
    this.executionLog.push(logEntry);
    
    if (this.options.debug) {
      console.warn(`[ScenarioRunner] ${message}`, data);
    }
  }

  logError(message, error = null) {
    const logEntry = { 
      level: 'error', 
      message, 
      error: error?.message || error, 
      timestamp: new Date().toISOString() 
    };
    
    this.executionLog.push(logEntry);
    this.errors.push(logEntry);
    
    if (this.options.debug) {
      console.error(`[ScenarioRunner] ${message}`, error);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Cleanup
  destroy() {
    this.stop();
    
    if (this.pageDetector) {
      this.pageDetector.destroy();
    }
    
    if (this.debugPanel) {
      this.debugPanel.remove();
    }
    
    this.callbacks = {};
  }
}

// Export cho sử dụng
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ScenarioRunner;
} else if (typeof window !== 'undefined') {
  window.ScenarioRunner = ScenarioRunner;
}