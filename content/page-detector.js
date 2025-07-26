/**
 * Page Detection System
 * Tự động nhận diện loại trang và mapping elements cho Speedway Motors
 * Hỗ trợ: Homepage, Search, Product, Category, Cart, Checkout, Account
 */

class PageDetector {
  constructor(options = {}) {
    this.options = {
      debug: options.debug || false,
      waitTimeout: options.waitTimeout || 10000,
      retryInterval: options.retryInterval || 500,
      ...options
    };
    
    this.currentPage = null;
    this.pageElements = new Map();
    this.observers = new Map();
    this.callbacks = new Map();
    
    // URL patterns cho các loại trang
    this.urlPatterns = this.initUrlPatterns();
    
    // Element selectors cho từng loại trang
    this.elementMaps = this.initElementMaps();
    
    // DOM indicators cho page detection
    this.pageIndicators = this.initPageIndicators();
    
    if (this.options.debug) {
      this.enableDebugMode();
    }
    
    // Auto-detect khi page load
    this.startAutoDetection();
  }

  /**
   * MAIN DETECTION METHODS
   */
  
  // Detect loại trang hiện tại
  async detectCurrentPage() {
    const pageInfo = {
      url: window.location.href,
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      title: document.title,
      timestamp: Date.now()
    };

    // Step 1: URL Pattern Detection
    const urlPageType = this.detectByUrlPattern(pageInfo.url);
    
    // Step 2: DOM Structure Detection
    const domPageType = await this.detectByDomStructure();
    
    // Step 3: Content Analysis Detection
    const contentPageType = await this.detectByContentAnalysis();
    
    // Step 4: Combine results with confidence scoring
    const detectionResult = this.combineDetectionResults({
      url: { type: urlPageType, confidence: 0.8 },
      dom: { type: domPageType, confidence: 0.9 },
      content: { type: contentPageType, confidence: 0.7 }
    });

    // Step 5: Get page elements và state
    const elements = await this.getPageElements(detectionResult.type);
    const pageState = await this.analyzePageState(detectionResult.type);
    
    this.currentPage = {
      ...pageInfo,
      type: detectionResult.type,
      subtype: detectionResult.subtype,
      confidence: detectionResult.confidence,
      elements: elements,
      state: pageState,
      metadata: await this.extractPageMetadata(detectionResult.type)
    };

    this.logDebug('Page detected:', this.currentPage);
    this.notifyPageChange(this.currentPage);
    
    return this.currentPage;
  }

  // URL pattern detection
  detectByUrlPattern(url) {
    for (const [pageType, patterns] of Object.entries(this.urlPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(url)) {
          return pageType;
        }
      }
    }
    return 'unknown';
  }

  // DOM structure detection
  async detectByDomStructure() {
    await this.waitForDomReady();
    
    for (const [pageType, indicators] of Object.entries(this.pageIndicators)) {
      let matchScore = 0;
      let totalChecks = 0;
      
      for (const indicator of indicators) {
        totalChecks++;
        const element = document.querySelector(indicator.selector);
        
        if (element) {
          // Check visibility
          if (this.isElementVisible(element)) {
            matchScore += indicator.weight || 1;
          }
        }
      }
      
      const confidence = totalChecks > 0 ? matchScore / totalChecks : 0;
      if (confidence > 0.6) {
        return pageType;
      }
    }
    
    return 'unknown';
  }

  // Content analysis detection
  async detectByContentAnalysis() {
    const contentIndicators = {
      homepage: [
        { text: 'race car parts', weight: 1 },
        { text: 'performance parts', weight: 1 },
        { text: 'speedway motors', weight: 1 },
        { text: 'featured products', weight: 0.8 }
      ],
      search: [
        { text: 'search results', weight: 1 },
        { text: 'results for', weight: 1 },
        { text: 'filter', weight: 0.8 },
        { text: 'sort by', weight: 0.8 }
      ],
      product: [
        { text: 'add to cart', weight: 1 },
        { text: 'part number', weight: 1 },
        { text: 'specifications', weight: 0.8 },
        { text: 'product details', weight: 0.8 }
      ],
      category: [
        { text: 'products', weight: 0.8 },
        { text: 'categories', weight: 0.8 },
        { text: 'view all', weight: 0.6 }
      ],
      cart: [
        { text: 'shopping cart', weight: 1 },
        { text: 'checkout', weight: 1 },
        { text: 'total', weight: 0.8 },
        { text: 'quantity', weight: 0.8 }
      ]
    };

    const pageText = document.body.textContent.toLowerCase();
    let bestMatch = 'unknown';
    let bestScore = 0;

    for (const [pageType, indicators] of Object.entries(contentIndicators)) {
      let score = 0;
      for (const indicator of indicators) {
        if (pageText.includes(indicator.text)) {
          score += indicator.weight;
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = pageType;
      }
    }

    return bestScore > 1 ? bestMatch : 'unknown';
  }

  /**
   * PAGE ELEMENTS MAPPING
   */
  
  // Lấy tất cả elements quan trọng của trang
  async getPageElements(pageType) {
    const elementMap = this.elementMaps[pageType];
    if (!elementMap) {
      return {};
    }

    const elements = {};
    
    for (const [elementName, selectors] of Object.entries(elementMap)) {
      const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
      
      for (const selector of selectorArray) {
        const element = await this.waitForElement(selector, 2000);
        if (element) {
          elements[elementName] = {
            element: element,
            selector: selector,
            visible: this.isElementVisible(element),
            interactive: this.isElementInteractive(element),
            rect: element.getBoundingClientRect(),
            attributes: this.getElementAttributes(element)
          };
          break; // Use first found element
        }
      }
    }

    this.pageElements.set(pageType, elements);
    return elements;
  }

  // Get specific element với fallback options
  async getElement(elementName, pageType = null) {
    const currentPageType = pageType || this.currentPage?.type;
    if (!currentPageType) {
      throw new Error('Page type not detected');
    }

    const pageElements = this.pageElements.get(currentPageType) || 
                        await this.getPageElements(currentPageType);
    
    const elementInfo = pageElements[elementName];
    if (!elementInfo) {
      throw new Error(`Element '${elementName}' not found on ${currentPageType} page`);
    }

    // Re-verify element is still valid
    if (!document.contains(elementInfo.element)) {
      // Element removed from DOM, re-find it
      const selector = elementInfo.selector;
      const newElement = await this.waitForElement(selector, 3000);
      if (newElement) {
        elementInfo.element = newElement;
        elementInfo.rect = newElement.getBoundingClientRect();
      } else {
        throw new Error(`Element '${elementName}' no longer exists`);
      }
    }

    return elementInfo;
  }

  /**
   * PAGE STATE ANALYSIS
   */
  
  async analyzePageState(pageType) {
    const state = {
      loading: this.isPageLoading(),
      interactive: document.readyState === 'interactive' || document.readyState === 'complete',
      scrollPosition: window.pageYOffset,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };

    // Page-specific state analysis
    switch (pageType) {
      case 'search':
        state.searchResults = await this.analyzeSearchResults();
        break;
      case 'product':
        state.productInfo = await this.analyzeProductInfo();
        break;
      case 'category':
        state.categoryInfo = await this.analyzeCategoryInfo();
        break;
      case 'cart':
        state.cartInfo = await this.analyzeCartInfo();
        break;
    }

    return state;
  }

  async analyzeSearchResults() {
    const results = document.querySelectorAll('[data-testid="product-tile"], .product-item, .search-result-item');
    const pagination = document.querySelector('.pagination, .pager');
    const filters = document.querySelectorAll('.filter-item, .facet');
    
    return {
      resultCount: results.length,
      hasResults: results.length > 0,
      hasPagination: !!pagination,
      filterCount: filters.length,
      currentPage: this.extractCurrentPage(),
      totalPages: this.extractTotalPages()
    };
  }

  async analyzeProductInfo() {
    const title = document.querySelector('h1, .product-title, [data-testid="product-title"]');
    const price = document.querySelector('.price, .product-price, [data-testid="price"]');
    const stock = document.querySelector('.stock, .availability, .in-stock');
    const addToCart = document.querySelector('.add-to-cart, [data-testid="add-to-cart"]');
    
    return {
      hasTitle: !!title,
      hasPrice: !!price,
      hasStock: !!stock,
      canAddToCart: !!addToCart && !addToCart.disabled,
      productId: this.extractProductId(),
      partNumber: this.extractPartNumber()
    };
  }

  async analyzeCategoryInfo() {
    const products = document.querySelectorAll('.product-item, .product-tile');
    const subcategories = document.querySelectorAll('.subcategory, .category-item');
    const breadcrumbs = document.querySelector('.breadcrumbs, .breadcrumb');
    
    return {
      productCount: products.length,
      subcategoryCount: subcategories.length,
      hasBreadcrumbs: !!breadcrumbs,
      categoryName: this.extractCategoryName()
    };
  }

  async analyzeCartInfo() {
    const items = document.querySelectorAll('.cart-item, .line-item');
    const total = document.querySelector('.total, .cart-total');
    const checkout = document.querySelector('.checkout-btn, [data-testid="checkout"]');
    
    return {
      itemCount: items.length,
      isEmpty: items.length === 0,
      hasTotal: !!total,
      canCheckout: !!checkout && !checkout.disabled,
      totalAmount: this.extractTotalAmount()
    };
  }

  /**
   * PAGE METADATA EXTRACTION
   */
  
  async extractPageMetadata(pageType) {
    const metadata = {
      title: document.title,
      description: this.getMetaContent('description'),
      keywords: this.getMetaContent('keywords'),
      canonical: this.getCanonicalUrl(),
      breadcrumbs: this.extractBreadcrumbs()
    };

    // Page-specific metadata
    switch (pageType) {
      case 'product':
        metadata.product = {
          name: this.extractProductName(),
          sku: this.extractProductSku(),
          brand: this.extractProductBrand(),
          category: this.extractProductCategory()
        };
        break;
      case 'search':
        metadata.search = {
          query: this.extractSearchQuery(),
          resultCount: this.extractSearchResultCount()
        };
        break;
      case 'category':
        metadata.category = {
          name: this.extractCategoryName(),
          level: this.extractCategoryLevel()
        };
        break;
    }

    return metadata;
  }

  /**
   * INITIALIZATION METHODS
   */
  
  initUrlPatterns() {
    return {
      homepage: [
        /^https?:\/\/(?:www\.)?speedwaymotors\.com\/?$/,
        /^https?:\/\/(?:www\.)?speedwaymotors\.com\/index/,
        /^https?:\/\/(?:www\.)?speedwaymotors\.com\/home/
      ],
      search: [
        /\/search/i,
        /\/results/i,
        /\?.*search=/i,
        /\?.*q=/i
      ],
      product: [
        /\/product\//i,
        /\/p\//i,
        /\/item\//i,
        /\/part\//i
      ],
      category: [
        /\/category\//i,
        /\/c\//i,
        /\/categories\//i,
        /\/parts\//i
      ],
      cart: [
        /\/cart/i,
        /\/shopping-cart/i,
        /\/basket/i
      ],
      checkout: [
        /\/checkout/i,
        /\/payment/i,
        /\/billing/i
      ],
      account: [
        /\/account/i,
        /\/profile/i,
        /\/login/i,
        /\/register/i
      ]
    };
  }

  initElementMaps() {
    return {
      homepage: {
        searchBar: ['#search-input', '.search-box input', '[data-testid="search-input"]'],
        searchButton: ['#search-button', '.search-btn', '[data-testid="search-btn"]'],
        categoryMenu: ['.category-nav', '.main-nav', '.navigation'],
        featuredProducts: ['.featured-products', '.hero-products', '.product-highlights'],
        promoSection: ['.promo-banner', '.hero-banner', '.promotional']
      },
      search: {
        searchResults: ['.search-results', '.product-grid', '.results-container'],
        resultItems: ['.product-item', '.product-tile', '[data-testid="product-tile"]'],
        pagination: ['.pagination', '.pager', '.page-numbers'],
        filters: ['.filters', '.facets', '.filter-panel'],
        sortDropdown: ['.sort-select', '.sort-dropdown', '[data-testid="sort"]'],
        resultCount: ['.result-count', '.search-count', '.total-results']
      },
      product: {
        productTitle: ['h1', '.product-title', '[data-testid="product-title"]'],
        productPrice: ['.price', '.product-price', '[data-testid="price"]'],
        addToCartButton: ['.add-to-cart', '[data-testid="add-to-cart"]', '.btn-add-cart'],
        productImages: ['.product-images', '.image-gallery', '.product-photos'],
        productDescription: ['.product-description', '.description', '.details'],
        stockStatus: ['.stock-status', '.availability', '.in-stock'],
        partNumber: ['.part-number', '.sku', '.product-code'],
        quantityInput: ['.quantity-input', 'input[name="quantity"]', '[data-testid="quantity"]']
      },
      category: {
        productGrid: ['.product-grid', '.products-container', '.category-products'],
        productItems: ['.product-item', '.product-tile', '.product-card'],
        categoryFilter: ['.category-filters', '.category-nav', '.subcategories'],
        sortOptions: ['.sort-options', '.sort-controls', '.sorting'],
        breadcrumbs: ['.breadcrumbs', '.breadcrumb', '.navigation-path'],
        loadMoreButton: ['.load-more', '.show-more', '[data-testid="load-more"]']
      },
      cart: {
        cartItems: ['.cart-items', '.line-items', '.shopping-cart-items'],
        cartItem: ['.cart-item', '.line-item', '.cart-product'],
        removeButton: ['.remove-item', '.delete-item', '[data-testid="remove"]'],
        quantityInput: ['.quantity-input', 'input[name="quantity"]'],
        updateButton: ['.update-cart', '.update-quantity'],
        subtotal: ['.subtotal', '.cart-subtotal'],
        total: ['.total', '.cart-total', '.grand-total'],
        checkoutButton: ['.checkout-btn', '[data-testid="checkout"]', '.proceed-checkout']
      },
      checkout: {
        billingForm: ['.billing-form', '.checkout-form'],
        shippingForm: ['.shipping-form', '.delivery-form'],
        paymentForm: ['.payment-form', '.credit-card-form'],
        orderSummary: ['.order-summary', '.checkout-summary'],
        placeOrderButton: ['.place-order', '.submit-order', '[data-testid="place-order"]']
      }
    };
  }

  initPageIndicators() {
    return {
      homepage: [
        { selector: '.hero-banner, .main-banner', weight: 1 },
        { selector: '.featured-products', weight: 0.8 },
        { selector: '.category-nav', weight: 0.8 }
      ],
      search: [
        { selector: '.search-results', weight: 1 },
        { selector: '.filter-panel', weight: 0.8 },
        { selector: '.pagination', weight: 0.6 }
      ],
      product: [
        { selector: '.add-to-cart', weight: 1 },
        { selector: '.product-images', weight: 0.9 },
        { selector: '.part-number', weight: 0.8 }
      ],
      category: [
        { selector: '.product-grid', weight: 1 },
        { selector: '.category-filters', weight: 0.8 },
        { selector: '.breadcrumbs', weight: 0.6 }
      ],
      cart: [
        { selector: '.cart-items', weight: 1 },
        { selector: '.checkout-btn', weight: 0.9 },
        { selector: '.cart-total', weight: 0.8 }
      ]
    };
  }

  /**
   * UTILITY METHODS
   */
  
  async waitForElement(selector, timeout = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const element = document.querySelector(selector);
      if (element && this.isElementVisible(element)) {
        return element;
      }
      await this.sleep(this.options.retryInterval);
    }
    
    return null;
  }

  async waitForDomReady() {
    if (document.readyState === 'complete') {
      return;
    }
    
    return new Promise(resolve => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolve);
      } else {
        resolve();
      }
    });
  }

  isElementVisible(element) {
    if (!element) return false;
    
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    return rect.width > 0 && 
           rect.height > 0 && 
           style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0';
  }

  isElementInteractive(element) {
    if (!element) return false;
    
    const style = window.getComputedStyle(element);
    const tagName = element.tagName.toLowerCase();
    
    return !element.disabled && 
           style.pointerEvents !== 'none' &&
           (tagName === 'button' || tagName === 'input' || tagName === 'select' || 
            tagName === 'textarea' || tagName === 'a' || element.onclick);
  }

  getElementAttributes(element) {
    const attrs = {};
    for (const attr of element.attributes) {
      attrs[attr.name] = attr.value;
    }
    return attrs;
  }

  combineDetectionResults(results) {
    let bestType = 'unknown';
    let bestScore = 0;
    let subtype = null;

    for (const [method, result] of Object.entries(results)) {
      const score = result.confidence;
      if (score > bestScore && result.type !== 'unknown') {
        bestScore = score;
        bestType = result.type;
      }
    }

    return {
      type: bestType,
      subtype: subtype,
      confidence: bestScore
    };
  }

  // Page change monitoring
  startAutoDetection() {
    // Listen for navigation changes
    window.addEventListener('popstate', () => this.detectCurrentPage());
    
    // Override pushState and replaceState
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      setTimeout(() => this.detectCurrentPage(), 100);
    };
    
    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      setTimeout(() => this.detectCurrentPage(), 100);
    };

    // Monitor DOM changes for dynamic content
    this.startDomObserver();
  }

  startDomObserver() {
    const observer = new MutationObserver((mutations) => {
      let significantChange = false;
      
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE && 
                (node.classList.contains('main') || 
                 node.classList.contains('content') ||
                 node.id === 'main')) {
              significantChange = true;
              break;
            }
          }
        }
      }
      
      if (significantChange) {
        setTimeout(() => this.detectCurrentPage(), 500);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    this.observers.set('dom', observer);
  }

  // Callbacks và events
  onPageChange(callback) {
    const id = Date.now() + Math.random();
    this.callbacks.set(id, callback);
    return id;
  }

  offPageChange(id) {
    this.callbacks.delete(id);
  }

  notifyPageChange(pageInfo) {
    for (const callback of this.callbacks.values()) {
      try {
        callback(pageInfo);
      } catch (error) {
        console.error('Page change callback error:', error);
      }
    }
  }

  // Extraction helpers
  extractProductId() {
    const url = window.location.pathname;
    const match = url.match(/\/product\/([^\/]+)/);
    return match ? match[1] : null;
  }

  extractPartNumber() {
    const partNumberEl = document.querySelector('.part-number, .sku, .product-code');
    return partNumberEl ? partNumberEl.textContent.trim() : null;
  }

  extractSearchQuery() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('q') || urlParams.get('search') || '';
  }

  extractBreadcrumbs() {
    const breadcrumbEl = document.querySelector('.breadcrumbs, .breadcrumb');
    if (!breadcrumbEl) return [];
    
    const links = breadcrumbEl.querySelectorAll('a, span');
    return Array.from(links).map(link => link.textContent.trim());
  }

  getMetaContent(name) {
    const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
    return meta ? meta.getAttribute('content') : null;
  }

  getCanonicalUrl() {
    const canonical = document.querySelector('link[rel="canonical"]');
    return canonical ? canonical.getAttribute('href') : null;
  }

  isPageLoading() {
    return document.readyState === 'loading' || 
           document.querySelector('.loading, .spinner, .loader') !== null;
  }

  // Debug methods
  enableDebugMode() {
    this.createDebugPanel();
    this.onPageChange((pageInfo) => {
      this.updateDebugPanel(pageInfo);
    });
  }

  createDebugPanel() {
    const panel = document.createElement('div');
    panel.id = 'page-detector-debug';
    panel.style.cssText = `
      position: fixed;
      bottom: 10px;
      left: 10px;
      width: 350px;
      max-height: 300px;
      background: rgba(0,0,0,0.9);
      color: white;
      padding: 15px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 11px;
      z-index: 999999;
      overflow-y: auto;
      border: 1px solid #333;
    `;
    document.body.appendChild(panel);
    this.debugPanel = panel;
  }

  updateDebugPanel(pageInfo) {
    if (!this.debugPanel) return;
    
    this.debugPanel.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px;">🔍 Page Detection Debug</div>
      <div><strong>Type:</strong> ${pageInfo.type}</div>
      <div><strong>Confidence:</strong> ${(pageInfo.confidence * 100).toFixed(1)}%</div>
      <div><strong>URL:</strong> ${pageInfo.pathname}</div>
      <div><strong>Elements:</strong> ${Object.keys(pageInfo.elements || {}).length}</div>
      <div><strong>State:</strong> ${pageInfo.state?.loading ? 'Loading' : 'Ready'}</div>
      <div style="margin-top: 10px;"><strong>Available Elements:</strong></div>
      <div style="font-size: 10px; opacity: 0.8;">
        ${Object.keys(pageInfo.elements || {}).join(', ')}
      </div>
    `;
  }

  logDebug(message, data = null) {
    if (this.options.debug) {
      console.log(`[PageDetector] ${message}`, data);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Cleanup
  destroy() {
    for (const observer of this.observers.values()) {
      observer.disconnect();
    }
    
    this.observers.clear();
    this.callbacks.clear();
    
    if (this.debugPanel) {
      this.debugPanel.remove();
    }
  }
}

// Export cho sử dụng
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PageDetector;
} else if (typeof window !== 'undefined') {
  window.PageDetector = PageDetector;
}