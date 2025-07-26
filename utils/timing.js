// =============================================================================
// TIMING ENGINE - HUMAN-LIKE BEHAVIOR FOUNDATION
// =============================================================================

class TimingEngine {
  constructor() {
    this.sessionStart = Date.now();
    this.actionHistory = [];
    this.userProfile = this.generateUserProfile();
    this.fatigueLevel = 0;
    this.attentionLevel = 1.0;
    this.debugMode = true;
    
    this.log('Timing Engine initialized', {
      profile: this.userProfile.type,
      readingWPM: Math.round(this.userProfile.readingWPM)
    });
  }
  
  generateUserProfile() {
    const profiles = {
      casual: {
        readingWPM: 120 + Math.random() * 80,
        patience: 0.4 + Math.random() * 0.4,
        scrollSpeed: 250 + Math.random() * 150,
        sessionLength: (5 + Math.random() * 10) * 60000
      },
      researcher: {
        readingWPM: 180 + Math.random() * 100,
        patience: 1.0 + Math.random() * 0.8,
        scrollSpeed: 100 + Math.random() * 100,
        sessionLength: (15 + Math.random() * 25) * 60000
      },
      shopper: {
        readingWPM: 160 + Math.random() * 80,
        patience: 0.7 + Math.random() * 0.5,
        scrollSpeed: 180 + Math.random() * 120,
        sessionLength: (8 + Math.random() * 17) * 60000
      }
    };
    
    const types = Object.keys(profiles);
    const selectedType = types[Math.floor(Math.random() * types.length)];
    
    return {
      type: selectedType,
      ...profiles[selectedType],
      startTime: Date.now()
    };
  }
  
  calculateReadingTime(text, contentType = 'paragraph') {
    if (!text || typeof text !== 'string') return 500;
    
    const contentMultipliers = {
      headline: 0.4,
      paragraph: 1.0,
      product: 0.7,
      specification: 1.3,
      navigation: 0.2,
      price: 0.3,
      description: 1.1
    };
    
    const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
    const baseTime = (wordCount / this.userProfile.readingWPM) * 60000;
    const contentMultiplier = contentMultipliers[contentType] || 1.0;
    const adjustedTime = baseTime * contentMultiplier * this.userProfile.patience;
    
    const variance = adjustedTime * 0.3 * (Math.random() - 0.5);
    const finalTime = adjustedTime + variance;
    
    return Math.max(200, Math.min(10000, finalTime));
  }
  
  getActionDelay(actionType, context = {}) {
    const baseDelays = {
      hover: { min: 100, max: 500 },
      click: { min: 200, max: 800 },
      scroll: { min: 50, max: 200 },
      page_load: { min: 1500, max: 4000 },
      reading: { min: 1000, max: 5000 },
      typing: { min: 80, max: 200 }
    };
    
    const delay = baseDelays[actionType] || baseDelays.click;
    const randomDelay = delay.min + Math.random() * (delay.max - delay.min);
    
    let multiplier = 1.0;
    if (actionType === 'scroll') {
      multiplier = 1000 / this.userProfile.scrollSpeed;
    } else if (actionType === 'reading') {
      multiplier = this.userProfile.patience;
    }
    
    const sessionMultiplier = this.getSessionMultiplier();
    const finalDelay = randomDelay * multiplier * sessionMultiplier;
    
    this.recordAction(actionType, finalDelay);
    return Math.round(finalDelay);
  }
  
  getSessionMultiplier() {
    const sessionDuration = Date.now() - this.sessionStart;
    const sessionProgress = sessionDuration / this.userProfile.sessionLength;
    
    this.fatigueLevel = Math.min(1.0, sessionProgress * 0.8);
    
    const fatigueMultiplier = 1 + (this.fatigueLevel * 0.5);
    return fatigueMultiplier;
  }
  
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  recordAction(type, duration) {
    this.actionHistory.push({
      type, duration, timestamp: Date.now()
    });
    
    if (this.actionHistory.length > 100) {
      this.actionHistory = this.actionHistory.slice(-50);
    }
  }
  
  log(message, data = {}) {
    if (this.debugMode) {
      console.log(`[TimingEngine] ${message}`, data);
    }
  }
  
  getStats() {
    return {
      profile: this.userProfile.type,
      readingWPM: Math.round(this.userProfile.readingWPM),
      actionsCount: this.actionHistory.length,
      sessionDuration: Date.now() - this.sessionStart,
      fatigueLevel: this.fatigueLevel
    };
  }
}

window.TimingEngine = TimingEngine;