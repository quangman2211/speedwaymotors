// =============================================================================
// NATURAL MOUSE MOVEMENT ENGINE - COMPLETE VERSION
// =============================================================================

class NaturalMouseEngine {
  constructor() {
    this.currentPosition = { x: 0, y: 0 };
    this.mouseHistory = [];
    this.movementProfile = this.generateMovementProfile();
    this.isMoving = false;
    
    this.setupMouseTracking();
    this.initializeMovementPatterns();
    
    console.log('[MouseEngine] Initialized with profile:', this.movementProfile.type);
  }
  
  generateMovementProfile() {
    const profiles = {
      precise: {
        type: 'precise',
        baseSpeed: 0.8,
        curvature: 0.1,
        overshootChance: 0.05,
        tremor: 0.02
      },
      casual: {
        type: 'casual',
        baseSpeed: 1.2,
        curvature: 0.25,
        overshootChance: 0.15,
        tremor: 0.05
      },
      quick: {
        type: 'quick',
        baseSpeed: 1.8,
        curvature: 0.15,
        overshootChance: 0.25,
        tremor: 0.03
      }
    };
    
    const profileTypes = Object.keys(profiles);
    const selectedType = profileTypes[Math.floor(Math.random() * profileTypes.length)];
    
    return {
      ...profiles[selectedType],
      sessionStart: Date.now(),
      totalDistance: 0,
      movementCount: 0
    };
  }
  
  setupMouseTracking() {
    document.addEventListener('mousemove', (e) => {
      if (!this.isMoving) {
        this.currentPosition = { x: e.clientX, y: e.clientY };
      }
    }, { passive: true });
  }
  
  initializeMovementPatterns() {
    this.startIdleMovements();
  }
  
  async moveToElement(element, options = {}) {
    if (!element || !element.getBoundingClientRect) {
      console.warn('[MouseEngine] Invalid element provided');
      return false;
    }
    
    const rect = element.getBoundingClientRect();
    const targetX = rect.left + this.calculateTargetOffset(rect.width);
    const targetY = rect.top + this.calculateTargetOffset(rect.height);
    
    return await this.moveToPosition(targetX, targetY, options);
  }
  
  async moveToPosition(targetX, targetY, options = {}) {
    const { force = false, speed = 1.0, context = 'general' } = options;
    
    if (!this.isValidPosition(targetX, targetY)) {
      console.warn('[MouseEngine] Invalid target position:', targetX, targetY);
      return false;
    }
    
    if (this.isMoving && !force) {
      await this.waitForMovementComplete();
    }
    
    this.isMoving = true;
    
    try {
      const shouldOvershoot = this.shouldOvershoot(targetX, targetY, context);
      
      if (shouldOvershoot) {
        await this.moveWithOvershoot(targetX, targetY, speed);
      } else {
        await this.moveDirectly(targetX, targetY, speed);
      }
      
      this.recordMovement(targetX, targetY);
      return true;
      
    } catch (error) {
      console.error('[MouseEngine] Movement error:', error);
      return false;
    } finally {
      this.isMoving = false;
    }
  }
  
  async moveDirectly(targetX, targetY, speed = 1.0) {
    const start = { ...this.currentPosition };
    const end = { x: targetX, y: targetY };
    
    const path = this.generateMovementPath(start, end);
    const distance = this.calculateDistance(start, end);
    const baseDuration = this.calculateMovementDuration(distance, speed);
    
    await this.executePath(path, baseDuration);
  }
  
  async moveWithOvershoot(targetX, targetY, speed = 1.0) {
    const overshootTarget = this.calculateOvershootPosition(targetX, targetY);
    
    await this.moveDirectly(overshootTarget.x, overshootTarget.y, speed * 1.1);
    await this.sleep(50 + Math.random() * 150);
    await this.moveDirectly(targetX, targetY, speed * 0.7);
  }
  
  generateMovementPath(start, end) {
    const distance = this.calculateDistance(start, end);
    
    if (distance < 20) {
      return this.generateStraightPath(start, end);
    } else if (distance > 200) {
      return this.generateComplexPath(start, end);
    } else {
      return this.generateCurvedPath(start, end);
    }
  }
  
  generateStraightPath(start, end) {
    const steps = Math.max(3, Math.floor(this.calculateDistance(start, end) / 15));
    const path = [];
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const point = {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t
      };
      path.push(this.addTremor(point));
    }
    
    return path;
  }
  
  generateCurvedPath(start, end) {
    const distance = this.calculateDistance(start, end);
    const steps = Math.max(15, Math.floor(distance / 12));
    
    const controlPoint = this.generateControlPoint(start, end);
    const path = [];
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const point = this.quadraticBezier(start, controlPoint, end, t);
      path.push(this.addTremor(point));
    }
    
    return path;
  }
  
  generateComplexPath(start, end) {
    const distance = this.calculateDistance(start, end);
    const steps = Math.max(20, Math.floor(distance / 10));
    
    const control1 = this.generateControlPoint(start, end, 0.3);
    const control2 = this.generateControlPoint(start, end, 0.7);
    
    const path = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const point = this.cubicBezier(start, control1, control2, end, t);
      path.push(this.addTremor(point));
    }
    
    return path;
  }
  
  generateControlPoint(start, end, position = 0.5) {
    const distance = this.calculateDistance(start, end);
    const curvature = this.movementProfile.curvature;
    
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const perpX = -dy;
    const perpY = dx;
    const perpLength = Math.sqrt(perpX * perpX + perpY * perpY);
    
    const normPerpX = perpLength > 0 ? perpX / perpLength : 0;
    const normPerpY = perpLength > 0 ? perpY / perpLength : 0;
    
    const maxOffset = distance * curvature;
    const actualOffset = maxOffset * (0.5 + Math.random() * 0.5);
    const direction = Math.random() < 0.5 ? 1 : -1;
    const finalOffset = actualOffset * direction;
    
    const midX = start.x + (end.x - start.x) * position;
    const midY = start.y + (end.y - start.y) * position;
    
    return {
      x: midX + normPerpX * finalOffset,
      y: midY + normPerpY * finalOffset
    };
  }
  
  addTremor(point) {
    const tremor = this.movementProfile.tremor;
    return {
      x: point.x + (Math.random() - 0.5) * tremor * 10,
      y: point.y + (Math.random() - 0.5) * tremor * 10
    };
  }
  
  quadraticBezier(p0, p1, p2, t) {
    const x = Math.pow(1 - t, 2) * p0.x + 
             2 * (1 - t) * t * p1.x + 
             Math.pow(t, 2) * p2.x;
             
    const y = Math.pow(1 - t, 2) * p0.y + 
             2 * (1 - t) * t * p1.y + 
             Math.pow(t, 2) * p2.y;
             
    return { x, y };
  }
  
  cubicBezier(p0, p1, p2, p3, t) {
    const x = Math.pow(1 - t, 3) * p0.x +
             3 * Math.pow(1 - t, 2) * t * p1.x +
             3 * (1 - t) * Math.pow(t, 2) * p2.x +
             Math.pow(t, 3) * p3.x;
             
    const y = Math.pow(1 - t, 3) * p0.y +
             3 * Math.pow(1 - t, 2) * t * p1.y +
             3 * (1 - t) * Math.pow(t, 2) * p2.y +
             Math.pow(t, 3) * p3.y;
             
    return { x, y };
  }
  
  async executePath(path, totalDuration) {
    const baseStepDelay = totalDuration / path.length;
    
    for (let i = 0; i < path.length; i++) {
      const point = path[i];
      
      this.dispatchMouseMove(point.x, point.y);
      this.currentPosition = { x: point.x, y: point.y };
      
      if (i < path.length - 1) {
        const progress = i / (path.length - 1);
        const speedMultiplier = this.calculateSpeedCurve(progress);
        const stepDelay = baseStepDelay / speedMultiplier;
        const variance = stepDelay * 0.2 * (Math.random() - 0.5);
        const finalDelay = Math.max(8, stepDelay + variance);
        
        await this.sleep(finalDelay);
      }
    }
  }
  
  calculateSpeedCurve(progress) {
    if (progress < 0.1) {
      return 0.3 + (progress * 7);
    } else if (progress > 0.8) {
      const decelProgress = (progress - 0.8) / 0.2;
      return 1.0 - (decelProgress * 0.6);
    } else {
      return 0.9 + Math.random() * 0.2;
    }
  }
  
  shouldOvershoot(targetX, targetY, context) {
    const distance = this.calculateDistance(this.currentPosition, { x: targetX, y: targetY });
    const baseChance = this.movementProfile.overshootChance;
    const distanceFactor = Math.min(2.0, distance / 200);
    
    const finalChance = baseChance * distanceFactor;
    return Math.random() < Math.min(0.3, finalChance);
  }
  
  calculateOvershootPosition(targetX, targetY) {
    const current = this.currentPosition;
    const dx = targetX - current.x;
    const dy = targetY - current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) return { x: targetX, y: targetY };
    
    const normDx = dx / distance;
    const normDy = dy / distance;
    const overshootDistance = 5 + Math.random() * 25;
    
    return {
      x: targetX + normDx * overshootDistance,
      y: targetY + normDy * overshootDistance
    };
  }
  
  startIdleMovements() {
    setInterval(() => {
      if (!this.isMoving && Math.random() < 0.1) {
        this.performIdleMovement();
      }
    }, 3000 + Math.random() * 5000);
  }
  
  async performIdleMovement() {
    const current = this.currentPosition;
    const distance = 5 + Math.random() * 15;
    const angle = Math.random() * Math.PI * 2;
    
    const targetX = Math.max(0, Math.min(window.innerWidth, current.x + Math.cos(angle) * distance));
    const targetY = Math.max(0, Math.min(window.innerHeight, current.y + Math.sin(angle) * distance));
    
    await this.moveToPosition(targetX, targetY, { speed: 0.3 });
  }
  
  calculateTargetOffset(dimension) {
    const centerBias = 0.3;
    if (Math.random() < centerBias) {
      return dimension * (0.4 + Math.random() * 0.2);
    } else {
      return dimension * (0.2 + Math.random() * 0.6);
    }
  }
  
  calculateDistance(point1, point2) {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  calculateMovementDuration(distance, speedMultiplier = 1.0) {
    const baseSpeed = this.movementProfile.baseSpeed * speedMultiplier;
    const baseDuration = (distance / baseSpeed) * 2;
    const variance = baseDuration * 0.2 * (Math.random() - 0.5);
    
    const minDuration = Math.max(50, distance * 0.5);
    const maxDuration = distance * 8;
    
    return Math.max(minDuration, Math.min(maxDuration, baseDuration + variance));
  }
  
  isValidPosition(x, y) {
    return x >= 0 && x <= window.innerWidth && 
           y >= 0 && y <= window.innerHeight &&
           !isNaN(x) && !isNaN(y);
  }
  
  dispatchMouseMove(x, y) {
    const element = document.elementFromPoint(x, y);
    if (!element) return;
    
    const event = new MouseEvent('mousemove', {
      clientX: x,
      clientY: y,
      bubbles: true,
      cancelable: true,
      view: window
    });
    
    element.dispatchEvent(event);
  }
  
  async waitForMovementComplete() {
    while (this.isMoving) {
      await this.sleep(10);
    }
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  recordMovement(x, y) {
    const movement = {
      target: { x, y },
      timestamp: Date.now(),
      distance: this.calculateDistance(this.currentPosition, { x, y })
    };
    
    this.mouseHistory.push(movement);
    this.movementProfile.movementCount++;
    this.movementProfile.totalDistance += movement.distance;
    
    if (this.mouseHistory.length > 100) {
      this.mouseHistory = this.mouseHistory.slice(-50);
    }
  }
  
  getPosition() {
    return { ...this.currentPosition };
  }
  
  isCurrentlyMoving() {
    return this.isMoving;
  }
  
  getMovementStats() {
    const sessionDuration = Date.now() - this.movementProfile.sessionStart;
    
    return {
      profile: this.movementProfile.type,
      sessionDuration: Math.round(sessionDuration / 1000),
      totalMovements: this.movementProfile.movementCount,
      totalDistance: Math.round(this.movementProfile.totalDistance)
    };
  }
}

window.NaturalMouseEngine = NaturalMouseEngine;