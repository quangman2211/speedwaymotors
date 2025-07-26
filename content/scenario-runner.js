/**
 * Critical fixes for Scenario Runner
 * Key fixes: Error handling, element finding, navigation detection
 */

// Add these fixes to the existing ScenarioRunner class:

// 1. Fix element finding with better fallbacks
async function fixedFindElement(step, timeout = null) {
  timeout = timeout || this.options.stepTimeout;
  
  // Try elementName first (page-specific element)
  if (step.elementName) {
    try {
      return await this.pageDetector.getElement(step.elementName);
    } catch (error) {
      this.logWarn(`Element '${step.elementName}' not found, trying fallback selector`);
    }
  }
  
  // Fallback to direct selector with multiple attempts
  if (step.selector) {
    const selectors = Array.isArray(step.selector) ? step.selector : [step.selector];
    
    for (const selector of selectors) {
      try {
        const element = await this.pageDetector.waitForElement(selector, timeout / selectors.length);
        if (element && this.pageDetector.isElementVisible(element)) {
          return {
            element: element,
            selector: selector,
            visible: true
          };
        }
      } catch (error) {
        console.debug(`Selector failed: ${selector}`, error.message);
      }
    }
  }
  
  throw new Error(`No element found for step: ${JSON.stringify(step)}`);
}

// 2. Fix navigation detection
async function fixedWaitForNavigation() {
  const startUrl = window.location.href;
  const timeout = 15000; // Increased timeout
  const startTime = Date.now();
  
  // Wait for URL change
  while (Date.now() - startTime < timeout) {
    if (window.location.href !== startUrl) {
      // URL changed, now wait for page to be ready
      await this.waitForPageReady();
      return;
    }
    await this.sleep(100);
  }
  
  // No navigation detected, check if page content changed significantly
  console.warn('No URL change detected, checking for content changes');
}

async function waitForPageReady() {
  const maxWait = 10000;
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWait) {
    if (document.readyState === 'complete' && 
        !document.querySelector('.loading, .spinner, [data-loading]')) {
      await this.sleep(500); // Additional settling time
      return;
    }
    await this.sleep(100);
  }
}

// 3. Fix click handler with retry logic
async function fixedHandleClick(step) {
  let retries = 3;
  let lastError;
  
  while (retries > 0) {
    try {
      const element = await this.findElement(step);
      
      if (!this.pageDetector.isElementVisible(element.element)) {
        throw new Error('Element is not visible');
      }
      
      if (step.scrollToElement !== false) {
        await this.humanSim.scrollToElement(element.element);
        await this.sleep(500); // Wait for scroll to complete
      }
      
      await this.humanSim.humanClick(element.element, {
        doubleClick: step.doubleClick || false,
        button: step.button || 'left'
      });
      
      // Handle post-click actions
      if (step.expectsNavigation) {
        await this.waitForNavigation();
      } else if (step.expectsContentChange) {
        await this.waitForContentChange();
      } else {
        await this.sleep(500); // Small delay for UI updates
      }
      
      return; // Success, exit retry loop
      
    } catch (error) {
      lastError = error;
      retries--;
      
      if (retries > 0) {
        this.logWarn(`Click failed, retrying (${3 - retries}/3): ${error.message}`);
        await this.sleep(1000); // Wait before retry
      }
    }
  }
  
  throw lastError;
}

// 4. Add these methods to ScenarioRunner class
ScenarioRunner.prototype.findElement = fixedFindElement;
ScenarioRunner.prototype.waitForNavigation = fixedWaitForNavigation;
ScenarioRunner.prototype.waitForPageReady = waitForPageReady;
ScenarioRunner.prototype.handleClick = fixedHandleClick;