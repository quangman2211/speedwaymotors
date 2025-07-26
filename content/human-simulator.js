/**
 * Human Simulation Engine
 * Giả lập hành vi người dùng thực tế cho Chrome Extension
 * Bao gồm: mouse movement, clicking, typing, scrolling với timing tự nhiên
 */

class HumanSimulator {
  constructor(options = {}) {
    this.options = {
      mouseSpeed: options.mouseSpeed || 1.0,        // Tốc độ di chuyển chuột (0.1 - 3.0)
      typingSpeed: options.typingSpeed || 1.0,      // Tốc độ gõ phím (0.1 - 3.0)
      humanness: options.humanness || 0.8,          // Độ "giống người" (0.1 - 1.0)
      debug: options.debug || false,                // Debug mode
      ...options
    };
    
    this.mousePosition = { x: 0, y: 0 };
    this.isMoving = false;
    this.movementHistory = [];
    this.typingPatterns = this.initTypingPatterns();
    
    if (this.options.debug) {
      this.enableDebugMode();
    }
  }

  /**
   * MOUSE MOVEMENT SIMULATION
   */
  
  // Di chuyển chuột đến element với đường cong tự nhiên
  async moveMouseToElement(element, options = {}) {
    if (!element) {
      throw new Error('Element not found for mouse movement');
    }

    const rect = element.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    
    // Tính toán vị trí target với random offset nhỏ
    const targetX = rect.left + scrollX + rect.width * (0.3 + Math.random() * 0.4);
    const targetY = rect.top + scrollY + rect.height * (0.3 + Math.random() * 0.4);
    
    return this.moveMouseTo({ x: targetX, y: targetY }, options);
  }

  // Di chuyển chuột đến tọa độ cụ thể
  async moveMouseTo(target, options = {}) {
    const config = {
      duration: options.duration || this.calculateMoveDuration(this.mousePosition, target),
      easing: options.easing || 'bezier',
      steps: options.steps || Math.max(20, Math.floor(this.getDistance(this.mousePosition, target) / 10)),
      ...options
    };

    if (this.isMoving) {
      await this.waitForMovementComplete();
    }

    this.isMoving = true;
    const path = this.generateMousePath(this.mousePosition, target, config);
    
    try {
      await this.animateMouseMovement(path, config);
      this.mousePosition = { ...target };
    } finally {
      this.isMoving = false;
    }
    
    return this.mousePosition;
  }

  // Tạo đường đi tự nhiên cho chuột
  generateMousePath(start, end, config) {
    const path = [];
    const { steps, easing } = config;
    
    // Tạo control points cho Bezier curve
    const controlPoints = this.generateControlPoints(start, end);
    
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
      
      // Thêm noise tự nhiên
      point.x += (Math.random() - 0.5) * 2 * this.options.humanness;
      point.y += (Math.random() - 0.5) * 2 * this.options.humanness;
      
      path.push(point);
    }
    
    return path;
  }

  // Animation mouse movement
  async animateMouseMovement(path, config) {
    const stepDelay = config.duration / path.length;
    
    for (let i = 0; i < path.length; i++) {
      const point = path[i];
      
      // Dispatch mouse move event
      this.dispatchMouseEvent('mousemove', point.x, point.y);
      
      // Tính delay với variation tự nhiên
      const delay = stepDelay + (Math.random() - 0.5) * stepDelay * 0.3;
      await this.sleep(Math.max(5, delay));
      
      // Log movement history
      this.movementHistory.push({ ...point, timestamp: Date.now() });
      if (this.movementHistory.length > 100) {
        this.movementHistory.shift();
      }
    }
  }

  /**
   * CLICKING SIMULATION
   */
  
  // Click với timing và behavior tự nhiên
  async humanClick(element, options = {}) {
    const config = {
      button: options.button || 'left',
      doubleClick: options.doubleClick || false,
      moveToElement: options.moveToElement !== false,
      pressDelay: options.pressDelay || this.randomBetween(50, 150),
      ...options
    };

    if (!element) {
      throw new Error('Element not found for clicking');
    }

    // Di chuyển đến element trước khi click
    if (config.moveToElement) {
      await this.moveMouseToElement(element);
      await this.sleep(this.randomBetween(100, 300)); // Pause trước khi click
    }

    // Simulate hover effect
    this.dispatchMouseEvent('mouseenter', this.mousePosition.x, this.mousePosition.y, element);
    this.dispatchMouseEvent('mouseover', this.mousePosition.x, this.mousePosition.y, element);
    
    await this.sleep(this.randomBetween(10, 50));

    if (config.doubleClick) {
      await this.performDoubleClick(element, config);
    } else {
      await this.performSingleClick(element, config);
    }

    return true;
  }

  async performSingleClick(element, config) {
    // Mouse down
    this.dispatchMouseEvent('mousedown', this.mousePosition.x, this.mousePosition.y, element);
    
    // Thời gian nhấn giữ tự nhiên
    await this.sleep(config.pressDelay);
    
    // Mouse up (tạo click event)
    this.dispatchMouseEvent('mouseup', this.mousePosition.x, this.mousePosition.y, element);
    this.dispatchMouseEvent('click', this.mousePosition.x, this.mousePosition.y, element);
    
    // Focus element nếu có thể
    if (element.focus && typeof element.focus === 'function') {
      element.focus();
    }
  }

  async performDoubleClick(element, config) {
    await this.performSingleClick(element, config);
    await this.sleep(this.randomBetween(20, 100)); // Delay giữa 2 clicks
    await this.performSingleClick(element, config);
    
    this.dispatchMouseEvent('dblclick', this.mousePosition.x, this.mousePosition.y, element);
  }

  /**
   * TYPING SIMULATION
   */
  
  // Gõ text với rhythm tự nhiên
  async humanType(element, text, options = {}) {
    const config = {
      clearFirst: options.clearFirst !== false,
      triggerEvents: options.triggerEvents !== false,
      mistakeRate: options.mistakeRate || 0.02 * this.options.humanness,
      ...options
    };

    if (!element) {
      throw new Error('Element not found for typing');
    }

    // Focus element
    await this.humanClick(element, { moveToElement: false });
    
    // Clear existing text
    if (config.clearFirst && element.value) {
      await this.clearText(element);
    }

    // Typing simulation
    let currentText = element.value || '';
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      // Simulate mistakes
      if (Math.random() < config.mistakeRate && i > 0) {
        await this.simulateTypingMistake(element, char);
        continue;
      }
      
      // Type character
      await this.typeCharacter(element, char);
      currentText += char;
      
      // Random typing delay
      const delay = this.getTypingDelay(char, text[i + 1]);
      await this.sleep(delay);
    }

    // Trigger final events
    if (config.triggerEvents) {
      this.dispatchKeyboardEvent(element, 'change');
      this.dispatchKeyboardEvent(element, 'blur');
    }

    return currentText;
  }

  async typeCharacter(element, char) {
    // Simulate keydown
    this.dispatchKeyboardEvent(element, 'keydown', char);
    
    // Update element value
    const startPos = element.selectionStart || element.value.length;
    const endPos = element.selectionEnd || element.value.length;
    
    const beforeText = element.value.substring(0, startPos);
    const afterText = element.value.substring(endPos);
    element.value = beforeText + char + afterText;
    
    // Set cursor position
    const newPos = startPos + 1;
    if (element.setSelectionRange) {
      element.setSelectionRange(newPos, newPos);
    }
    
    // Trigger events
    this.dispatchKeyboardEvent(element, 'keypress', char);
    this.dispatchKeyboardEvent(element, 'input', char);
    this.dispatchKeyboardEvent(element, 'keyup', char);
  }

  async simulateTypingMistake(element, correctChar) {
    // Type wrong character
    const wrongChar = this.getRandomWrongChar(correctChar);
    await this.typeCharacter(element, wrongChar);
    await this.sleep(this.randomBetween(200, 800)); // Realize mistake
    
    // Backspace to correct
    await this.simulateBackspace(element);
    await this.sleep(this.randomBetween(100, 300));
    
    // Type correct character
    await this.typeCharacter(element, correctChar);
  }

  async simulateBackspace(element) {
    if (element.value.length === 0) return;
    
    this.dispatchKeyboardEvent(element, 'keydown', 'Backspace');
    
    // Remove character
    const cursorPos = element.selectionStart || element.value.length;
    if (cursorPos > 0) {
      element.value = element.value.substring(0, cursorPos - 1) + 
                     element.value.substring(cursorPos);
      
      if (element.setSelectionRange) {
        element.setSelectionRange(cursorPos - 1, cursorPos - 1);
      }
    }
    
    this.dispatchKeyboardEvent(element, 'input');
    this.dispatchKeyboardEvent(element, 'keyup', 'Backspace');
  }

  /**
   * SCROLLING SIMULATION
   */
  
  // Cuộn trang tự nhiên
  async humanScroll(options = {}) {
    const config = {
      direction: options.direction || 'down',
      distance: options.distance || 300,
      speed: options.speed || 'medium',
      element: options.element || window,
      ...options
    };

    const scrollSteps = this.calculateScrollSteps(config.distance, config.speed);
    const stepSize = config.distance / scrollSteps;
    const baseDelay = this.getScrollDelay(config.speed);

    for (let i = 0; i < scrollSteps; i++) {
      const scrollAmount = config.direction === 'down' ? stepSize : -stepSize;
      
      // Scroll với variation tự nhiên
      const actualScroll = scrollAmount + (Math.random() - 0.5) * stepSize * 0.1;
      
      if (config.element === window) {
        window.scrollBy(0, actualScroll);
      } else {
        config.element.scrollTop += actualScroll;
      }
      
      // Dispatch scroll event
      const scrollEvent = new Event('scroll', { bubbles: true });
      (config.element === window ? document : config.element).dispatchEvent(scrollEvent);
      
      // Variable delay để tạo rhythm tự nhiên
      const delay = baseDelay + (Math.random() - 0.5) * baseDelay * 0.4;
      await this.sleep(delay);
    }
  }

  // Cuộn đến element cụ thể
  async scrollToElement(element, options = {}) {
    if (!element) {
      throw new Error('Element not found for scrolling');
    }

    const rect = element.getBoundingClientRect();
    const elementTop = rect.top + window.pageYOffset;
    const elementCenter = elementTop - window.innerHeight / 2 + rect.height / 2;
    
    const currentScroll = window.pageYOffset;
    const distance = elementCenter - currentScroll;
    
    if (Math.abs(distance) < 50) {
      return; // Already in view
    }

    return this.humanScroll({
      direction: distance > 0 ? 'down' : 'up',
      distance: Math.abs(distance),
      ...options
    });
  }

  /**
   * UTILITY METHODS
   */
  
  // Tính khoảng cách giữa 2 điểm
  getDistance(point1, point2) {
    return Math.sqrt(
      Math.pow(point2.x - point1.x, 2) + 
      Math.pow(point2.y - point1.y, 2)
    );
  }

  // Tính thời gian di chuyển chuột
  calculateMoveDuration(start, end) {
    const distance = this.getDistance(start, end);
    const baseTime = distance / 2; // pixels per ms
    const speedMultiplier = 1 / this.options.mouseSpeed;
    return Math.max(100, baseTime * speedMultiplier);
  }

  // Generate control points cho Bezier curve
  generateControlPoints(start, end) {
    const distance = this.getDistance(start, end);
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    
    // Tạo độ cong tự nhiên
    const curviness = distance * 0.2 * this.options.humanness;
    const angle = Math.random() * Math.PI * 2;
    
    const control1 = {
      x: midX + Math.cos(angle) * curviness,
      y: midY + Math.sin(angle) * curviness
    };
    
    const control2 = {
      x: midX - Math.cos(angle) * curviness,
      y: midY - Math.sin(angle) * curviness
    };
    
    return [control1, control2];
  }

  // Cubic Bezier curve calculation
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

  // Arc movement calculation
  arcMovement(start, end, t) {
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const distance = this.getDistance(start, end);
    const height = distance * 0.3 * this.options.humanness;
    
    const x = start.x + (end.x - start.x) * t;
    const y = start.y + (end.y - start.y) * t + Math.sin(t * Math.PI) * height;
    
    return { x, y };
  }

  // Linear movement
  linearMovement(start, end, t) {
    return {
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t
    };
  }

  // Typing patterns và delays
  initTypingPatterns() {
    return {
      common: { min: 80, max: 120 },
      space: { min: 100, max: 200 },
      punctuation: { min: 150, max: 250 },
      uppercase: { min: 120, max: 180 },
      numbers: { min: 100, max: 150 }
    };
  }

  getTypingDelay(currentChar, nextChar) {
    let pattern = this.typingPatterns.common;
    
    if (currentChar === ' ') pattern = this.typingPatterns.space;
    else if (/[.!?,:;]/.test(currentChar)) pattern = this.typingPatterns.punctuation;
    else if (/[A-Z]/.test(currentChar)) pattern = this.typingPatterns.uppercase;
    else if (/[0-9]/.test(currentChar)) pattern = this.typingPatterns.numbers;
    
    const baseDelay = this.randomBetween(pattern.min, pattern.max);
    const speedMultiplier = 1 / this.options.typingSpeed;
    
    return baseDelay * speedMultiplier;
  }

  getRandomWrongChar(correctChar) {
    const keyboard = 'qwertyuiopasdfghjklzxcvbnm';
    const index = keyboard.indexOf(correctChar.toLowerCase());
    
    if (index === -1) return correctChar;
    
    // Adjacent keys are more likely mistakes
    const adjacent = [];
    if (index > 0) adjacent.push(keyboard[index - 1]);
    if (index < keyboard.length - 1) adjacent.push(keyboard[index + 1]);
    
    return adjacent.length > 0 ? 
      adjacent[Math.floor(Math.random() * adjacent.length)] : 
      keyboard[Math.floor(Math.random() * keyboard.length)];
  }

  // Scroll calculations
  calculateScrollSteps(distance, speed) {
    const speedMap = { slow: 20, medium: 15, fast: 10 };
    return Math.max(5, Math.floor(distance / (speedMap[speed] || 15)));
  }

  getScrollDelay(speed) {
    const delayMap = { slow: 100, medium: 60, fast: 30 };
    return delayMap[speed] || 60;
  }

  // Event dispatching
  dispatchMouseEvent(type, x, y, element = null) {
    const event = new MouseEvent(type, {
      clientX: x,
      clientY: y,
      screenX: x,
      screenY: y,
      bubbles: true,
      cancelable: true,
      view: window
    });
    
    const target = element || document.elementFromPoint(x, y) || document.body;
    target.dispatchEvent(event);
  }

  dispatchKeyboardEvent(element, type, key = '') {
    const event = new KeyboardEvent(type, {
      key: key,
      code: `Key${key.toUpperCase()}`,
      bubbles: true,
      cancelable: true
    });
    
    element.dispatchEvent(event);
  }

  // Utility functions
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

  async clearText(element) {
    if (!element.value) return;
    
    // Select all text
    if (element.setSelectionRange) {
      element.setSelectionRange(0, element.value.length);
    }
    
    // Delete selected text
    for (let i = 0; i < element.value.length; i++) {
      await this.simulateBackspace(element);
      await this.sleep(this.randomBetween(20, 50));
    }
  }

  // Debug mode
  enableDebugMode() {
    this.debugOverlay = this.createDebugOverlay();
    document.body.appendChild(this.debugOverlay);
  }

  createDebugOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'human-sim-debug';
    overlay.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: 300px;
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 10px;
      border-radius: 5px;
      font-family: monospace;
      font-size: 12px;
      z-index: 999999;
      pointer-events: none;
    `;
    return overlay;
  }

  updateDebugInfo(info) {
    if (this.debugOverlay) {
      this.debugOverlay.innerHTML = `
        <div>Mouse: ${this.mousePosition.x.toFixed(0)}, ${this.mousePosition.y.toFixed(0)}</div>
        <div>Moving: ${this.isMoving}</div>
        <div>Speed: ${this.options.mouseSpeed}x</div>
        <div>Humanness: ${this.options.humanness}</div>
        <div>${info || ''}</div>
      `;
    }
  }
}

// Export cho sử dụng
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HumanSimulator;
} else if (typeof window !== 'undefined') {
  window.HumanSimulator = HumanSimulator;
}