/**
 * Human Simulation Engine - Improved Version
 * Enhanced với performance, memory management, và advanced features
 */

class HumanSimulator {
  constructor(options = {}) {
    this.options = {
      mouseSpeed: options.mouseSpeed || 1.0,
      typingSpeed: options.typingSpeed || 1.0,
      humanness: options.humanness || 0.8,
      debug: options.debug || false,
      frameRate: options.frameRate || 60, // Max FPS for animations
      ...options
    };
    
    this.mousePosition = { x: 0, y: 0 };
    this.isMoving = false;
    this.movementHistory = [];
    this.typingPatterns = this.initTypingPatterns();
    this.debugInterval = null;
    this.animationFrame = null;
    this.lastFrameTime = 0;
    
    // Performance tracking
    this.performanceStats = {
      mouseMoves: 0,
      clicks: 0,
      keystrokes: 0,
      startTime: Date.now()
    };
    
    // Initialize
    this.initializeMousePosition();
    this.setupGlobalListeners();
    
    if (this.options.debug) {
      this.enableDebugMode();
      console.log('[HumanSim] Initialized with enhanced features:', this.options);
    }
  }

  initializeMousePosition() {
    // Try multiple methods to get real mouse position
    this.mousePosition = this.getRealMousePosition() || this.getFallbackPosition();
    
    // Setup real-time mouse tracking
    this.setupMouseTracking();
  }

  getRealMousePosition() {
    // Method 1: Check if we have recent mouse events
    if (window.lastMouseEvent) {
      return { 
        x: window.lastMouseEvent.clientX, 
        y: window.lastMouseEvent.clientY 
      };
    }
    
    // Method 2: Try to get from cursor position (if available)
    if (document.activeElement) {
      const rect = document.activeElement.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        };
      }
    }
    
    return null;
  }

  getFallbackPosition() {
    // Fallback to viewport center
    const rect = document.documentElement.getBoundingClientRect();
    return {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    };
  }

  setupMouseTracking() {
    // Track real mouse movements to sync position
    const mouseTracker = (e) => {
      if (!this.isMoving) {
        this.mousePosition = { x: e.clientX, y: e.clientY };
        window.lastMouseEvent = e;
      }
    };
    
    document.addEventListener('mousemove', mouseTracker, { passive: true });
    
    // Store reference for cleanup
    this.mouseTracker = mouseTracker;
  }

  setupGlobalListeners() {
    // Handle page visibility changes
    this.visibilityChangeHandler = () => {
      if (document.hidden && this.isMoving) {
        console.log('[HumanSim] Page hidden, pausing movements');
        this.isMoving = false;
      }
    };
    
    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
  }

  /**
   * ENHANCED MOUSE MOVEMENT
   */
  
  async moveMouseToElement(element, options = {}) {
    if (!this.validateElement(element)) {
      throw new Error('Invalid or inaccessible element for mouse movement');
    }

    // Wait for element to be stable
    await this.waitForElementStability(element);

    const rect = element.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    
    // Smart target position calculation
    const targetPos = this.calculateOptimalTargetPosition(rect, options);
    const targetX = rect.left + scrollX + targetPos.x;
    const targetY = rect.top + scrollY + targetPos.y;
    
    return this.moveMouseTo({ x: targetX, y: targetY }, options);
  }

  validateElement(element) {
    if (!element || !element.getBoundingClientRect) return false;
    if (!document.contains(element)) return false;
    
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    
    // Check if element is visible
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    
    return true;
  }

  async waitForElementStability(element, timeout = 1000) {
    const startTime = Date.now();
    let lastRect = element.getBoundingClientRect();
    
    while (Date.now() - startTime < timeout) {
      await this.sleep(50);
      const currentRect = element.getBoundingClientRect();
      
      if (this.areRectsEqual(lastRect, currentRect)) {
        return; // Element is stable
      }
      
      lastRect = currentRect;
    }
  }

  areRectsEqual(rect1, rect2, tolerance = 2) {
    return Math.abs(rect1.left - rect2.left) <= tolerance &&
           Math.abs(rect1.top - rect2.top) <= tolerance &&
           Math.abs(rect1.width - rect2.width) <= tolerance &&
           Math.abs(rect1.height - rect2.height) <= tolerance;
  }

  calculateOptimalTargetPosition(rect, options) {
    const { targetZone = 'center', avoidEdges = true } = options;
    
    let x, y;
    
    switch (targetZone) {
      case 'center':
        x = rect.width * (0.4 + Math.random() * 0.2);
        y = rect.height * (0.4 + Math.random() * 0.2);
        break;
      case 'random':
        x = rect.width * (avoidEdges ? 0.1 + Math.random() * 0.8 : Math.random());
        y = rect.height * (avoidEdges ? 0.1 + Math.random() * 0.8 : Math.random());
        break;
      default:
        x = rect.width * 0.5;
        y = rect.height * 0.5;
    }
    
    return { x, y };
  }

  async moveMouseTo(target, options = {}) {
    if (this.isMoving && !options.force) {
      await this.waitForMovementComplete();
    }

    // Validate target position
    if (!this.isValidPosition(target.x, target.y)) {
      throw new Error(`Invalid target position: ${target.x}, ${target.y}`);
    }

    this.isMoving = true;
    const startTime = Date.now();
    
    try {
      const config = this.calculateMovementConfig(this.mousePosition, target, options);
      const path = this.generateOptimizedPath(this.mousePosition, target, config);
      
      await this.animateMouseMovementOptimized(path, config);
      
      this.mousePosition = { ...target };
      this.performanceStats.mouseMoves++;
      
      if (this.options.debug) {
        const duration = Date.now() - startTime;
        console.log(`[HumanSim] Mouse moved to (${target.x}, ${target.y}) in ${duration}ms`);
      }
      
    } catch (error) {
      console.error('[HumanSim] Mouse movement error:', error);
      throw error;
    } finally {
      this.isMoving = false;
    }
    
    return this.mousePosition;
  }

  calculateMovementConfig(start, end, options) {
    const distance = this.getDistance(start, end);
    const baseTime = Math.max(100, distance * 1.5); // Minimum 100ms
    const speedMultiplier = 1 / this.options.mouseSpeed;
    
    return {
      duration: options.duration || (baseTime * speedMultiplier),
      easing: options.easing || (distance > 200 ? 'bezier' : 'arc'),
      steps: Math.max(10, Math.min(50, Math.floor(distance / 15))),
      frameRate: this.options.frameRate,
      ...options
    };
  }

  generateOptimizedPath(start, end, config) {
    const { steps, easing } = config;
    const path = [];
    
    // Pre-calculate control points for better performance
    const controlPoints = easing === 'bezier' ? 
      this.generateControlPoints(start, end) : null;
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      let point;
      
      switch (easing) {
        case 'bezier':
          point = this.cubicBezier(start, controlPoints[0], controlPoints[1], end, t);
          break;
        case 'arc':
          point = this.arcMovement(start, end, t);
          break;
        default:
          point = this.linearMovement(start, end, t);
      }
      
      // Add human-like variation
      point.x += this.getHumanVariation();
      point.y += this.getHumanVariation();
      
      path.push(point);
    }
    
    return path;
  }

  getHumanVariation() {
    return (Math.random() - 0.5) * 2 * this.options.humanness;
  }

  async animateMouseMovementOptimized(path, config) {
    const frameTime = 1000 / config.frameRate;
    const totalSteps = path.length;
    let currentStep = 0;
    
    return new Promise((resolve, reject) => {
      const animate = (timestamp) => {
        if (!this.lastFrameTime) this.lastFrameTime = timestamp;
        const deltaTime = timestamp - this.lastFrameTime;
        
        if (deltaTime >= frameTime) {
          if (currentStep < totalSteps) {
            const point = path[currentStep];
            
            try {
              this.dispatchMouseEventSafe('mousemove', point.x, point.y);
              this.recordMovementPoint(point);
              
              currentStep++;
              this.lastFrameTime = timestamp;
              
              // Continue animation
              this.animationFrame = requestAnimationFrame(animate);
            } catch (error) {
              reject(error);
              return;
            }
          } else {
            // Animation complete
            this.lastFrameTime = 0;
            resolve();
          }
        } else {
          // Wait for next frame
          this.animationFrame = requestAnimationFrame(animate);
        }
      };
      
      this.animationFrame = requestAnimationFrame(animate);
    });
  }

  dispatchMouseEventSafe(type, x, y, element = null) {
    try {
      const target = element || this.getElementAtPosition(x, y);
      if (!target) return;
      
      const event = new MouseEvent(type, {
        clientX: x,
        clientY: y,
        screenX: x,
        screenY: y,
        bubbles: true,
        cancelable: true,
        view: window
      });
      
      target.dispatchEvent(event);
    } catch (error) {
      if (this.options.debug) {
        console.warn('[HumanSim] Mouse event dispatch failed:', error.message);
      }
    }
  }

  getElementAtPosition(x, y) {
    // Use elementFromPoint with fallback
    const element = document.elementFromPoint(x, y);
    return element || document.body;
  }

  recordMovementPoint(point) {
    this.movementHistory.push({ 
      ...point, 
      timestamp: Date.now() 
    });
    
    // Keep history manageable
    if (this.movementHistory.length > 200) {
      this.movementHistory = this.movementHistory.slice(-100);
    }
  }

  /**
   * ENHANCED CLICKING
   */
  
  async humanClick(element, options = {}) {
    if (!this.validateElement(element)) {
      throw new Error('Element is not clickable');
    }

    const config = {
      button: options.button || 'left',
      doubleClick: options.doubleClick || false,
      moveToElement: options.moveToElement !== false,
      pressDelay: options.pressDelay || this.calculateClickDelay(),
      preClickDelay: options.preClickDelay || this.randomBetween(50, 200),
      ...options
    };

    // Move to element if requested
    if (config.moveToElement) {
      await this.moveMouseToElement(element, { targetZone: 'center' });
      await this.sleep(config.preClickDelay);
    }

    // Pre-click hover effects
    await this.simulateHoverSequence(element);

    // Perform click
    if (config.doubleClick) {
      await this.performDoubleClickSequence(element, config);
    } else {
      await this.performSingleClickSequence(element, config);
    }

    this.performanceStats.clicks++;
    
    if (this.options.debug) {
      console.log('[HumanSim] Clicked element:', element.tagName, element.className);
    }

    return true;
  }

  calculateClickDelay() {
    // Human-like click duration based on context
    const baseDelay = 80 + Math.random() * 120;
    const humannessFactor = 1 + (this.options.humanness * 0.5);
    return Math.floor(baseDelay * humannessFactor);
  }

  async simulateHoverSequence(element) {
    const events = ['mouseenter', 'mouseover'];
    for (const eventType of events) {
      this.dispatchMouseEventSafe(eventType, this.mousePosition.x, this.mousePosition.y, element);
      await this.sleep(this.randomBetween(10, 30));
    }
  }

  async performSingleClickSequence(element, config) {
    // Mouse down
    this.dispatchMouseEventSafe('mousedown', this.mousePosition.x, this.mousePosition.y, element);
    
    // Hold duration with slight variation
    const holdTime = config.pressDelay + this.randomBetween(-20, 20);
    await this.sleep(Math.max(50, holdTime));
    
    // Mouse up and click
    this.dispatchMouseEventSafe('mouseup', this.mousePosition.x, this.mousePosition.y, element);
    this.dispatchMouseEventSafe('click', this.mousePosition.x, this.mousePosition.y, element);
    
    // Focus if appropriate
    this.attemptElementFocus(element);
  }

  async performDoubleClickSequence(element, config) {
    await this.performSingleClickSequence(element, config);
    await this.sleep(this.randomBetween(50, 150)); // Inter-click delay
    await this.performSingleClickSequence(element, config);
    
    this.dispatchMouseEventSafe('dblclick', this.mousePosition.x, this.mousePosition.y, element);
  }

  attemptElementFocus(element) {
    try {
      if (element.focus && typeof element.focus === 'function') {
        // Check if element can be focused
        const style = window.getComputedStyle(element);
        if (style.pointerEvents !== 'none' && !element.disabled) {
          element.focus();
        }
      }
    } catch (error) {
      // Ignore focus errors
    }
  }

  /**
   * ENHANCED TYPING
   */
  
  async humanType(element, text, options = {}) {
    if (!element) {
      throw new Error('Element not found for typing');
    }

    const config = {
      clearFirst: options.clearFirst !== false,
      triggerEvents: options.triggerEvents !== false,
      mistakeRate: Math.min(0.1, options.mistakeRate || 0.02 * this.options.humanness),
      useNaturalRhythm: options.useNaturalRhythm !== false,
      simulateKeyboardShortcuts: options.simulateKeyboardShortcuts || false,
      ...options
    };

    // Ensure element is focused and ready
    await this.prepareElementForTyping(element, config);

    // Clear existing content if requested
    if (config.clearFirst && this.getElementValue(element)) {
      await this.clearElementContent(element, config);
    }

    // Type the text with natural rhythm
    await this.typeTextWithRhythm(element, text, config);

    // Trigger final events
    if (config.triggerEvents) {
      this.dispatchKeyboardEventSafe(element, 'change');
      this.dispatchKeyboardEventSafe(element, 'blur');
    }

    this.performanceStats.keystrokes += text.length;
    
    if (this.options.debug) {
      console.log('[HumanSim] Typed text:', text);
    }

    return this.getElementValue(element);
  }

  async prepareElementForTyping(element, config) {
    // Click to focus
    await this.humanClick(element, { moveToElement: false });
    
    // Wait for focus
    await this.sleep(50);
    
    // Verify element is ready for input
    if (!this.isElementTypeable(element)) {
      throw new Error('Element is not ready for text input');
    }
  }

  isElementTypeable(element) {
    const tagName = element.tagName.toLowerCase();
    const inputTypes = ['text', 'email', 'password', 'search', 'url', 'tel'];
    
    if (tagName === 'input') {
      return inputTypes.includes(element.type || 'text');
    }
    
    return tagName === 'textarea' || element.contentEditable === 'true';
  }

  getElementValue(element) {
    if (element.contentEditable === 'true') {
      return element.textContent || element.innerText || '';
    }
    return element.value || '';
  }

  async clearElementContent(element, config) {
    if (config.simulateKeyboardShortcuts) {
      // Use Ctrl+A + Delete for more natural clearing
      await this.simulateKeyboardShortcut(element, 'selectAll');
      await this.sleep(50);
      await this.simulateKeyPress('Delete', element);
    } else {
      // Manual character-by-character deletion
      await this.clearTextManually(element);
    }
  }

  async simulateKeyboardShortcut(element, shortcut) {
    switch (shortcut) {
      case 'selectAll':
        // Ctrl+A
        await this.simulateKeyCombo(element, ['Control', 'a']);
        break;
      case 'copy':
        await this.simulateKeyCombo(element, ['Control', 'c']);
        break;
      case 'paste':
        await this.simulateKeyCombo(element, ['Control', 'v']);
        break;
    }
  }

  async simulateKeyCombo(element, keys) {
    // Press modifier keys first
    for (const key of keys.slice(0, -1)) {
      this.dispatchKeyboardEventSafe(element, 'keydown', key);
    }
    
    // Press main key
    const mainKey = keys[keys.length - 1];
    this.dispatchKeyboardEventSafe(element, 'keydown', mainKey);
    this.dispatchKeyboardEventSafe(element, 'keypress', mainKey);
    this.dispatchKeyboardEventSafe(element, 'keyup', mainKey);
    
    // Release modifier keys
    for (const key of keys.slice(0, -1).reverse()) {
      this.dispatchKeyboardEventSafe(element, 'keyup', key);
    }
  }

  async typeTextWithRhythm(element, text, config) {
    const words = text.split(' ');
    let globalPosition = 0;
    
    for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
      const word = words[wordIndex];
      
      // Type word character by character
      for (let charIndex = 0; charIndex < word.length; charIndex++) {
        const char = word[charIndex];
        
        // Simulate typing mistakes occasionally
        if (config.mistakeRate > 0 && Math.random() < config.mistakeRate) {
          await this.simulateTypingMistakeSequence(element, char);
        } else {
          await this.typeCharacterNaturally(element, char);
        }
        
        // Natural typing rhythm delay
        const delay = this.calculateTypingDelay(char, word[charIndex + 1], config);
        await this.sleep(delay);
        
        globalPosition++;
      }
      
      // Add space between words (except for last word)
      if (wordIndex < words.length - 1) {
        await this.typeCharacterNaturally(element, ' ');
        
        // Longer pause between words
        const wordDelay = this.calculateWordDelay(config);
        await this.sleep(wordDelay);
        
        globalPosition++;
      }
    }
  }

  async typeCharacterNaturally(element, char) {
    // Pre-type events
    this.dispatchKeyboardEventSafe(element, 'keydown', char);
    
    // Update element value
    this.updateElementValue(element, char);
    
    // Post-type events
    this.dispatchKeyboardEventSafe(element, 'keypress', char);
    this.dispatchKeyboardEventSafe(element, 'input', char);
    this.dispatchKeyboardEventSafe(element, 'keyup', char);
  }

  updateElementValue(element, char) {
    try {
      if (element.contentEditable === 'true') {
        // Handle contentEditable elements
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createTextNode(char));
          range.collapse(false);
        } else {
          element.textContent += char;
        }
      } else {
        // Handle input/textarea elements
        const start = element.selectionStart || element.value.length;
        const end = element.selectionEnd || element.value.length;
        
        const before = element.value.substring(0, start);
        const after = element.value.substring(end);
        element.value = before + char + after;
        
        // Update cursor position
        const newPos = start + 1;
        if (element.setSelectionRange) {
          element.setSelectionRange(newPos, newPos);
        }
      }
    } catch (error) {
      console.warn('[HumanSim] Failed to update element value:', error);
    }
  }

  calculateTypingDelay(currentChar, nextChar, config) {
    const pattern = this.getCharacterTypingPattern(currentChar);
    const baseDelay = this.randomBetween(pattern.min, pattern.max);
    
    // Speed adjustment
    const speedMultiplier = 1 / this.options.typingSpeed;
    
    // Context adjustments
    let contextMultiplier = 1;
    if (nextChar && this.isDigraphPair(currentChar, nextChar)) {
      contextMultiplier *= 0.8; // Faster for common letter pairs
    }
    
    return Math.floor(baseDelay * speedMultiplier * contextMultiplier);
  }

  calculateWordDelay(config) {
    const baseDelay = this.randomBetween(150, 300);
    const thinkingDelay = Math.random() < 0.1 ? this.randomBetween(300, 800) : 0;
    return baseDelay + thinkingDelay;
  }

  getCharacterTypingPattern(char) {
    if (char === ' ') return this.typingPatterns.space;
    if (/[.!?,:;]/.test(char)) return this.typingPatterns.punctuation;
    if (/[A-Z]/.test(char)) return this.typingPatterns.uppercase;
    if (/[0-9]/.test(char)) return this.typingPatterns.numbers;
    return this.typingPatterns.common;
  }

  isDigraphPair(char1, char2) {
    const commonPairs = ['th', 'he', 'in', 'er', 'an', 're', 'ed', 'nd', 'ha', 'to'];
    return commonPairs.includes((char1 + char2).toLowerCase());
  }

  async simulateTypingMistakeSequence(element, correctChar) {
    // Type wrong character
    const wrongChar = this.getRandomWrongChar(correctChar);
    await this.typeCharacterNaturally(element, wrongChar);
    
    // Pause to "notice" mistake
    await this.sleep(this.randomBetween(300, 1000));
    
    // Backspace to correct
    await this.simulateBackspace(element);
    await this.sleep(this.randomBetween(100, 300));
    
    // Type correct character
    await this.typeCharacterNaturally(element, correctChar);
  }

  async simulateBackspace(element) {
    this.dispatchKeyboardEventSafe(element, 'keydown', 'Backspace');
    
    try {
      if (element.contentEditable === 'true') {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          if (range.collapsed) {
            range.setStart(range.startContainer, Math.max(0, range.startOffset - 1));
          }
          range.deleteContents();
        }
      } else {
        const cursorPos = element.selectionStart || element.value.length;
        if (cursorPos > 0) {
          element.value = element.value.substring(0, cursorPos - 1) + 
                         element.value.substring(cursorPos);
          
          if (element.setSelectionRange) {
            element.setSelectionRange(cursorPos - 1, cursorPos - 1);
          }
        }
      }
    } catch (error) {
      console.warn('[HumanSim] Backspace simulation failed:', error);
    }
    
    this.dispatchKeyboardEventSafe(element, 'input');
    this.dispatchKeyboardEventSafe(element, 'keyup', 'Backspace');
  }

  async clearTextManually(element) {
    const currentValue = this.getElementValue(element);
    if (!currentValue) return;
    
    // Select all first
    try {
      if (element.select) {
        element.select();
      } else if (element.setSelectionRange) {
        element.setSelectionRange(0, currentValue.length);
      }
      
      // Delete selected text
      for (let i = 0; i < currentValue.length; i++) {
        await this.simulateBackspace(element);
        
        // Occasional pause during clearing
        if (i % 10 === 0 && Math.random() < 0.3) {
          await this.sleep(this.randomBetween(50, 150));
        }
      }
    } catch (error) {
      // Fallback: just set value to empty
      element.value = '';
    }
  }

  // Enhanced simulateKeyPress method
  async simulateKeyPress(key, element = null) {
    const target = element || document.activeElement || document.body;
    
    this.dispatchKeyboardEventSafe(target, 'keydown', key);
    await this.sleep(this.randomBetween(50, 100));
    this.dispatchKeyboardEventSafe(target, 'keypress', key);
    await this.sleep(this.randomBetween(20, 50));
    this.dispatchKeyboardEventSafe(target, 'keyup', key);
    
    // Special handling for specific keys
    if (key === 'Enter') {
      await this.handleEnterKeyPress(target);
    } else if (key === 'Tab') {
      await this.handleTabKeyPress(target);
    }
  }

  async handleEnterKeyPress(element) {
    // Try to find and submit associated form
    const form = element.closest('form');
    if (form) {
      await this.sleep(50);
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);
    }
  }

  async handleTabKeyPress(element) {
    // Focus next focusable element
    const focusableElements = this.getFocusableElements();
    const currentIndex = focusableElements.indexOf(element);
    
    if (currentIndex >= 0 && currentIndex < focusableElements.length - 1) {
      const nextElement = focusableElements[currentIndex + 1];
      try {
        nextElement.focus();
      } catch (error) {
        // Ignore focus errors
      }
    }
  }

  getFocusableElements() {
    const selector = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(document.querySelectorAll(selector));
  }

  /**
   * ENHANCED SCROLLING
   */
  
  async humanScroll(options = {}) {
    const config = {
      direction: options.direction || 'down',
      distance: options.distance || 300,
      speed: options.speed || 'medium',
      element: options.element || window,
      smoothness: options.smoothness || 'natural',
      ...options
    };

    // Validate scroll target
    if (!this.canElementScroll(config.element, config.direction)) {
      console.warn('[HumanSim] Element cannot scroll in requested direction');
      return;
    }

    // Calculate scroll parameters
    const scrollParams = this.calculateScrollParameters(config);
    
    // Execute scroll with momentum simulation
    await this.executeScrollWithMomentum(config.element, scrollParams);
  }

  canElementScroll(element, direction) {
    if (element === window) {
      const body = document.body;
      const html = document.documentElement;
      const maxScrollY = Math.max(body.scrollHeight, html.scrollHeight) - window.innerHeight;
      
      if (direction === 'down') return window.pageYOffset < maxScrollY;
      if (direction === 'up') return window.pageYOffset > 0;
    } else {
      if (direction === 'down') return element.scrollTop < element.scrollHeight - element.clientHeight;
      if (direction === 'up') return element.scrollTop > 0;
    }
    
    return false;
  }

  calculateScrollParameters(config) {
    const speedMultipliers = { slow: 0.5, medium: 1.0, fast: 1.8 };
    const speedMultiplier = speedMultipliers[config.speed] || 1.0;
    
    const steps = Math.max(8, Math.floor(config.distance / (20 * speedMultiplier)));
    const baseDelay = 60 / speedMultiplier;
    
    return {
      steps,
      stepSize: config.distance / steps,
      baseDelay,
      direction: config.direction === 'down' ? 1 : -1
    };
  }

  async executeScrollWithMomentum(element, params) {
    const { steps, stepSize, baseDelay, direction } = params;
    
    for (let i = 0; i < steps; i++) {
      // Calculate momentum-based step size
      const momentum = this.calculateScrollMomentum(i / steps);
      const actualStepSize = stepSize * momentum * direction;
      
      // Add natural variation
      const variation = (Math.random() - 0.5) * stepSize * 0.1;
      const finalStepSize = actualStepSize + variation;
      
      // Perform scroll
      if (element === window) {
        window.scrollBy(0, finalStepSize);
      } else {
        element.scrollTop += finalStepSize;
      }
      
      // Dispatch scroll event
      const scrollEvent = new Event('scroll', { bubbles: true });
      (element === window ? document : element).dispatchEvent(scrollEvent);
      
      // Natural delay with variation
      const delay = baseDelay + (Math.random() - 0.5) * baseDelay * 0.3;
      await this.sleep(Math.max(16, delay)); // Minimum 60fps
    }
  }

  calculateScrollMomentum(progress) {
    // Ease-out function for natural deceleration
    return 1 - Math.pow(progress, 2);
  }

  async scrollToElement(element, options = {}) {
    if (!this.validateElement(element)) {
      throw new Error('Invalid element for scrolling');
    }

    const rect = element.getBoundingClientRect();
    const elementTop = rect.top + window.pageYOffset;
    const viewportHeight = window.innerHeight;
    
    // Calculate target scroll position (element center in viewport)
    const targetY = elementTop - viewportHeight / 2 + rect.height / 2;
    const currentY = window.pageYOffset;
    const distance = targetY - currentY;
    
    if (Math.abs(distance) < 50) {
      return; // Already in view
    }

    // Smooth scroll to target
    await this.humanScroll({
      direction: distance > 0 ? 'down' : 'up',
      distance: Math.abs(distance),
      speed: options.speed || 'medium',
      ...options
    });

    // Verify element is in view
    await this.sleep(100);
    const newRect = element.getBoundingClientRect();
    const isInView = newRect.top >= 0 && newRect.bottom <= window.innerHeight;
    
    if (!isInView && this.options.debug) {
      console.warn('[HumanSim] Element may not be fully in view after scroll');
    }
  }

  /**
   * UTILITY METHODS - ENHANCED
   */
  
  getDistance(point1, point2) {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  isValidPosition(x, y) {
    return x >= 0 && x <= window.innerWidth && 
           y >= 0 && y <= window.innerHeight &&
           !isNaN(x) && !isNaN(y) && 
           isFinite(x) && isFinite(y);
  }

  generateControlPoints(start, end) {
    const distance = this.getDistance(start, end);
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    
    // Adaptive curviness based on distance and humanness
    const curviness = Math.min(distance * 0.25, 100) * this.options.humanness;
    const angle = Math.random() * Math.PI * 2;
    
    const control1 = {
      x: midX + Math.cos(angle) * curviness,
      y: midY + Math.sin(angle) * curviness
    };
    
    const control2 = {
      x: midX - Math.cos(angle) * curviness * 0.7,
      y: midY - Math.sin(angle) * curviness * 0.7
    };
    
    return [control1, control2];
  }

  cubicBezier(p0, p1, p2, p3, t) {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;
    
    return {
      x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
      y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y
    };
  }

  arcMovement(start, end, t) {
    const distance = this.getDistance(start, end);
    const height = distance * 0.3 * this.options.humanness;
    
    const x = start.x + (end.x - start.x) * t;
    const y = start.y + (end.y - start.y) * t + Math.sin(t * Math.PI) * height;
    
    return { x, y };
  }

  linearMovement(start, end, t) {
    return {
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t
    };
  }

  initTypingPatterns() {
    return {
      common: { min: 80, max: 120 },
      space: { min: 100, max: 200 },
      punctuation: { min: 150, max: 250 },
      uppercase: { min: 120, max: 180 },
      numbers: { min: 100, max: 150 }
    };
  }

  getRandomWrongChar(correctChar) {
    const qwerty = [
      'qwertyuiop',
      'asdfghjkl',
      'zxcvbnm'
    ];
    
    let row = -1, col = -1;
    
    // Find position of correct char
    for (let r = 0; r < qwerty.length; r++) {
      const c = qwerty[r].indexOf(correctChar.toLowerCase());
      if (c >= 0) {
        row = r;
        col = c;
        break;
      }
    }
    
    if (row === -1) return correctChar;
    
    // Get adjacent keys
    const adjacent = [];
    const directions = [[-1,-1], [-1,0], [-1,1], [0,-1], [0,1], [1,-1], [1,0], [1,1]];
    
    for (const [dr, dc] of directions) {
      const newRow = row + dr;
      const newCol = col + dc;
      
      if (newRow >= 0 && newRow < qwerty.length && 
          newCol >= 0 && newCol < qwerty[newRow].length) {
        adjacent.push(qwerty[newRow][newCol]);
      }
    }
    
    return adjacent.length > 0 ? 
      adjacent[Math.floor(Math.random() * adjacent.length)] : 
      correctChar;
  }

  dispatchKeyboardEventSafe(element, type, key = '') {
    try {
      const event = new KeyboardEvent(type, {
        key: key,
        code: key ? `Key${key.toUpperCase()}` : '',
        bubbles: true,
        cancelable: true
      });
      
      element.dispatchEvent(event);
    } catch (error) {
      if (this.options.debug) {
        console.warn('[HumanSim] Keyboard event dispatch failed:', error.message);
      }
    }
  }

  randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async waitForMovementComplete() {
    while (this.isMoving) {
      await this.sleep(10);
    }
  }

  /**
   * DEBUG AND PERFORMANCE
   */
  
  enableDebugMode() {
    this.createDebugOverlay();
    
    // Update every 500ms instead of 100ms for better performance
    this.debugInterval = setInterval(() => {
      this.updateDebugInfo();
    }, 500);
  }

  createDebugOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'human-sim-debug';
    overlay.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: 320px;
      background: rgba(0,0,0,0.85);
      color: white;
      padding: 12px;
      border-radius: 6px;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      z-index: 999999;
      pointer-events: none;
      border: 1px solid #333;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(overlay);
    this.debugOverlay = overlay;
  }

  updateDebugInfo() {
    if (!this.debugOverlay) return;
    
    const stats = this.getPerformanceStats();
    
    this.debugOverlay.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px; color: #4CAF50;">🤖 Human Simulator Debug</div>
      <div><strong>Position:</strong> ${this.mousePosition.x.toFixed(0)}, ${this.mousePosition.y.toFixed(0)}</div>
      <div><strong>Status:</strong> ${this.isMoving ? 'Moving' : 'Idle'}</div>
      <div><strong>Settings:</strong> Speed ${this.options.mouseSpeed}x, Human ${this.options.humanness}</div>
      <div style="margin-top: 8px;"><strong>Performance:</strong></div>
      <div>• Moves: ${stats.mouseMoves} | Clicks: ${stats.clicks}</div>
      <div>• Keys: ${stats.keystrokes} | Uptime: ${stats.uptimeSeconds}s</div>
      <div>• History: ${this.movementHistory.length}/200</div>
    `;
  }

  getPerformanceStats() {
    const uptime = Date.now() - this.performanceStats.startTime;
    
    return {
      ...this.performanceStats,
      uptimeSeconds: Math.floor(uptime / 1000),
      movesPerMinute: Math.round((this.performanceStats.mouseMoves * 60000) / uptime),
      clicksPerMinute: Math.round((this.performanceStats.clicks * 60000) / uptime)
    };
  }

  // Cleanup method
  destroy() {
    // Stop animations
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    
    // Clear intervals
    if (this.debugInterval) {
      clearInterval(this.debugInterval);
    }
    
    // Remove debug overlay
    if (this.debugOverlay && this.debugOverlay.parentNode) {
      this.debugOverlay.parentNode.removeChild(this.debugOverlay);
    }
    
    // Remove event listeners
    if (this.mouseTracker) {
      document.removeEventListener('mousemove', this.mouseTracker);
    }
    
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    }
    
    // Clear state
    this.isMoving = false;
    this.movementHistory = [];
    
    console.log('[HumanSim] Human Simulator destroyed and cleaned up');
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HumanSimulator;
} else if (typeof window !== 'undefined') {
  window.HumanSimulator = HumanSimulator;
}

console.log('[HumanSim] Enhanced Human Simulator loaded successfully');