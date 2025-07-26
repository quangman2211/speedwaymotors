// ============================================================================
// DEBUG HELPER - Run in browser console for troubleshooting
// ============================================================================

/**
 * Comprehensive debug tool for Speedway Motors extension
 * Run this in browser console to diagnose issues
 */

function debugSpeedwayExtension() {
  console.log('🔍 === SPEEDWAY EXTENSION DEBUG REPORT ===');
  
  // 1. Check basic environment
  console.log('\n📋 ENVIRONMENT CHECK:');
  console.log('URL:', window.location.href);
  console.log('On Speedway Motors:', window.location.href.includes('speedwaymotors.com'));
  console.log('Document ready state:', document.readyState);
  console.log('User agent:', navigator.userAgent);
  
  // 2. Check extension presence
  console.log('\n🔌 EXTENSION CHECK:');
  console.log('Chrome runtime available:', !!window.chrome?.runtime);
  console.log('Extension ID:', chrome?.runtime?.id);
  
  // 3. Check dependencies
  console.log('\n📦 DEPENDENCIES CHECK:');
  const dependencies = [
    'HumanSimulator',
    'PageDetector', 
    'ScenarioRunner',
    'TimingEngine',
    'NaturalMouseEngine'
  ];
  
  dependencies.forEach(dep => {
    const exists = window[dep] !== undefined;
    console.log(`${exists ? '✅' : '❌'} ${dep}:`, exists ? 'Loaded' : 'Missing');
    
    if (exists && typeof window[dep] === 'function') {
      try {
        const instance = new window[dep]();
        console.log(`  └─ Can instantiate: ✅`);
      } catch (error) {
        console.log(`  └─ Instantiation error: ❌`, error.message);
      }
    }
  });
  
  // 4. Check main extension object
  console.log('\n🤖 MAIN EXTENSION CHECK:');
  const speedway = window.speedwayAutoBrowser;
  if (speedway) {
    console.log('✅ Main extension object exists');
    console.log('Status:', speedway.getStatus ? speedway.getStatus() : 'No getStatus method');
    console.log('Initialized:', speedway.isInitialized);
    console.log('Has scenario runner:', !!speedway.scenarioRunner);
    console.log('Settings:', speedway.settings);
  } else {
    console.log('❌ Main extension object missing');
  }
  
  // 5. Check content scripts
  console.log('\n📜 CONTENT SCRIPTS CHECK:');
  const scripts = Array.from(document.querySelectorAll('script')).filter(s => 
    s.src && (s.src.includes('content/') || s.src.includes('utils/'))
  );
  console.log('Injected scripts:', scripts.map(s => s.src));
  
  // 6. Check for errors
  console.log('\n🚨 ERROR CHECK:');
  const errors = [];
  
  // Override console.error temporarily to catch errors
  const originalError = console.error;
  console.error = function(...args) {
    errors.push(args.join(' '));
    originalError.apply(console, args);
  };
  
  setTimeout(() => {
    console.error = originalError;
    console.log('Recent errors:', errors);
  }, 1000);
  
  // 7. Check network
  console.log('\n🌐 NETWORK CHECK:');
  try {
    fetch(chrome.runtime.getURL('manifest.json'))
      .then(response => {
        console.log('✅ Extension files accessible');
      })
      .catch(error => {
        console.log('❌ Extension files not accessible:', error);
      });
  } catch (error) {
    console.log('❌ Network check failed:', error);
  }
  
  // 8. DOM Analysis
  console.log('\n🏗️ DOM ANALYSIS:');
  const indicators = {
    'Search elements': document.querySelectorAll('input[type="search"], .search-input, #search').length,
    'Navigation elements': document.querySelectorAll('nav, .navigation, .nav').length,
    'Product elements': document.querySelectorAll('.product, .product-item, [data-product]').length,
    'Cart elements': document.querySelectorAll('.cart, #cart, .shopping-cart').length,
    'Loading elements': document.querySelectorAll('.loading, .spinner, .loader').length
  };
  
  Object.entries(indicators).forEach(([name, count]) => {
    console.log(`${name}: ${count}`);
  });
  
  // 9. Provide fixes
  console.log('\n🔧 SUGGESTED FIXES:');
  
  if (!window.speedwayAutoBrowser) {
    console.log('❗ Main extension not loaded. Try:');
    console.log('  1. Refresh the page');
    console.log('  2. Check if extension is enabled');
    console.log('  3. Verify you\'re on speedwaymotors.com');
  }
  
  const missingDeps = dependencies.filter(dep => !window[dep]);
  if (missingDeps.length > 0) {
    console.log('❗ Missing dependencies:', missingDeps.join(', '));
    console.log('  1. Check manifest.json script loading order');
    console.log('  2. Verify files exist in extension directory');
    console.log('  3. Check for JavaScript errors in console');
  }
  
  // 10. Recovery actions
  console.log('\n🚑 RECOVERY ACTIONS:');
  
  window.recoverExtension = function() {
    console.log('🔄 Attempting extension recovery...');
    
    // Clear any existing instances
    delete window.speedwayAutoBrowser;
    
    // Wait for dependencies and reinitialize
    setTimeout(() => {
      if (window.SpeedwayAutoBrowser) {
        window.speedwayAutoBrowser = new SpeedwayAutoBrowser();
        console.log('✅ Extension recovery attempted');
      } else {
        console.log('❌ Recovery failed - SpeedwayAutoBrowser class not available');
      }
    }, 1000);
  };
  
  window.testMessage = function() {
    console.log('📨 Testing message communication...');
    
    chrome.runtime.sendMessage({ action: 'ping' }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('❌ Message failed:', chrome.runtime.lastError.message);
      } else {
        console.log('✅ Message successful:', response);
      }
    });
  };
  
  window.forceReload = function() {
    console.log('🔄 Force reloading extension...');
    chrome.runtime.reload();
  };
  
  console.log('\n🛠️ Available recovery functions:');
  console.log('  recoverExtension() - Attempt to reinitialize');
  console.log('  testMessage() - Test popup communication');
  console.log('  forceReload() - Reload extension');
  
  console.log('\n✅ Debug report complete!');
  
  return {
    environment: { url: window.location.href, ready: document.readyState },
    extension: !!window.speedwayAutoBrowser,
    dependencies: dependencies.map(dep => ({ name: dep, loaded: !!window[dep] })),
    errors: errors,
    dom: indicators
  };
}

// Auto-run if in console
console.log('🎯 Speedway Extension Debug Helper loaded');
console.log('Run debugSpeedwayExtension() for full diagnosis');

// Export for use
window.debugSpeedwayExtension = debugSpeedwayExtension;