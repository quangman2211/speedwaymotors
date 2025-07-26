/**
 * Page Detection System - Improved Version
 * Enhanced với performance, reliability, và comprehensive detection
 */

class PageDetector {
  constructor(options = {}) {
    this.options = {
      debug: options.debug || false,
      waitTimeout: options.waitTimeout || 10000,
      retryInterval: options.retryInterval || 500,
      maxRetries: options.maxRetries || 3,
      debounceDelay: options.debounceDelay || 1000,
      cacheTimeout: options.cacheTimeout || 30000,
      ...options
    };
    
    this.currentPage = null;
    this.pageElements = new Map();
    this.observers = new Map();
    this.callbacks = new Map();
    this.detectionCache = new Map();
    this.lastDetectionTime = 0;
    this.isDetecting = false;
    this.detectionQueue = [];
    
    // Performance tracking
    this.performanceStats = {
      detections: 0,
      cacheHits: 0,
      avgDetectionTime: 0,
      errors: 0
    };
    
    // Initialize patterns and selectors
    this.urlPatterns = this.initUrlPatterns();
    this.elementMaps = this.initElementMaps();
    this.pageIndicators = this.initPageIndicators();
    this.contentPatterns = this.initContentPatterns();
    
    // Debounced detection function
    this.debouncedDetection = this.debounce(
      this.performDetection.bind(this), 
      this.options.debounceDelay
    );
    
    if (this.options.debug) {
      this.enableDebugMode();
      console.log('[PageDetector] Enhanced page detector initialized');
    }
    
    // Start detection system
    this.startAutoDetection();
    
    console.log('[PageDetector] Page detector loaded with enhanced features');
  }

  /**
   * MAIN DETECTION METHODS - ENHANCED
   */
  
  async detectCurrentPage() {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cached = this.getCachedDetection();
      if (cached) {
        this.performanceStats.cacheHits++;
        return cached;
      }
      
      // Prevent concurrent detections
      if (this.isDetecting) {
        return new Promise((resolve) => {
          this.detectionQueue.push(resolve);
        });
      }
      
      this.isDetecting = true;
      const result = await this.performDetection();
      
      // Cache result
      this.cacheDetection(result);
      
      // Resolve queued detections
      this.resolveQueuedDetections(result);
      
      return result;
      
    } catch (error) {
      this.performanceStats.errors++;
      console.error('[PageDetector] Detection failed:', error);
      
      // Return fallback detection
      return this.getFallbackDetection(error);
      
    } finally {
      this.isDetecting = false;
      
      // Update performance stats
      const duration = Date.now() - startTime;
      this.updatePerformanceStats(duration);
    }
  }

  async performDetection() {
    const pageInfo = {
      url: window.location.href,
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      title: document.title,
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    };

    // Multi-stage detection with error handling
    const detectionMethods = [
      { name: 'url', method: () => this.detectByUrlPattern(pageInfo.url), weight: 0.7 },
      { name: 'dom', method: () => this.detectByDomStructure(), weight: 0.9 },
      { name: 'content', method: () => this.detectByContentAnalysis(), weight: 0.6 },
      { name: 'meta', method: () => this.detectByMetadata(), weight: 0.5 }
    ];

    const results = {};
    
    for (const { name, method, weight } of detectionMethods) {
      try {
        const result = await this.withTimeout(method(), 5000);
        results[name] = { type: result, confidence: weight, method: name };
      } catch (error) {
        console.warn(`[PageDetector] ${name} detection failed:`, error.message);
        results[name] = { type: 'unknown', confidence: 0, error: error.message };
      }
    }

    // Enhanced result combination
    const detectionResult = this.combineDetectionResults(results);

    // Get page elements và state
    const elements = await this.getPageElementsSafe(detectionResult.type);
    const pageState = await this.analyzePageStateSafe(detectionResult.type);
    
    this.currentPage = {
      ...pageInfo,
      type: detectionResult.type,
      subtype: detectionResult.subtype,
      confidence: detectionResult.confidence,
      elements: elements,
      state: pageState,
      metadata: await this.extractPageMetadataSafe(detectionResult.type),
      detectionMethods: results
    };

    this.logDebug('Page detected:', this.currentPage);
    this.notifyPageChange(this.currentPage);
    
    return this.currentPage;
  }

  detectByUrlPattern(url) {
    // Enhanced URL detection với scoring
    let bestMatch = { type: 'unknown', score: 0 };
    
    for (const [pageType, patterns] of Object.entries(this.urlPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(url)) {
          // Calculate match specificity score
          const score = this.calculatePatternScore(pattern, url);
          if (score > bestMatch.score) {
            bestMatch = { type: pageType, score };
          }
        }
      }
    }
    
    this.logDebug(`URL pattern match: ${bestMatch.type} (${bestMatch.score})`);
    return bestMatch.type;
  }

  calculatePatternScore(pattern, url) {
    // More specific patterns get higher scores
    const patternStr = pattern.toString();
    let score = 1;
    
    // Bonus for specific paths
    if (patternStr.includes('\\/')) score += 0.3;
    
    // Bonus for query parameters
    if (patternStr.includes('\\?')) score += 0.2;
    
    // Bonus for exact matches
    if (!patternStr.includes('.*') && !patternStr.includes('.+')) score += 0.5;
    
    return score;
  }

  async detectByDomStructure() {
    await this.waitForDomReady();
    
    const detectionResults = {};
    
    for (const [pageType, indicators] of Object.entries(this.pageIndicators)) {
      let matchScore = 0;
      let totalWeight = 0;
      let foundIndicators = [];
      
      for (const indicator of indicators) {
        totalWeight += indicator.weight || 1;
        
        try {
          const elements = document.querySelectorAll(indicator.selector);
          const visibleElements = Array.from(elements).filter(el => this.isElementVisible(el));
          
          if (visibleElements.length > 0) {
            const weight = indicator.weight || 1;
            matchScore += weight;
            foundIndicators.push({
              selector: indicator.selector,
              count: visibleElements.length,
              weight: weight
            });
          }
        } catch (error) {
          console.warn(`[PageDetector] DOM selector failed: ${indicator.selector}`);
        }
      }
      
      const confidence = totalWeight > 0 ? matchScore / totalWeight : 0;
      detectionResults[pageType] = {
        confidence,
        matchScore,
        totalWeight,
        indicators: foundIndicators
      };
    }
    
    // Find best match
    let bestType = 'unknown';
    let bestConfidence = 0;
    
    for (const [pageType, result] of Object.entries(detectionResults)) {
      if (result.confidence > bestConfidence && result.confidence > 0.5) {
        bestConfidence = result.confidence;
        bestType = pageType;
      }
    }
    
    this.logDebug(`DOM structure match: ${bestType} (${bestConfidence.toFixed(2)})`, detectionResults[bestType]);
    return bestType;
  }

  async detectByContentAnalysis() {
    const pageText = document.body.textContent.toLowerCase();
    const pageHTML = document.body.innerHTML.toLowerCase();
    
    const results = {};
    
    for (const [pageType, patterns] of Object.entries(this.contentPatterns)) {
      let score = 0;
      let matches = [];
      
      for (const pattern of patterns) {
        const text = pattern.text.toLowerCase();
        const weight = pattern.weight || 1;
        
        // Text content matching
        const textMatches = (pageText.match(new RegExp(text, 'g')) || []).length;
        
        // HTML structure matching (for class names, IDs, etc.)
        const htmlMatches = pattern.html ? 
          (pageHTML.match(new RegExp(pattern.html, 'g')) || []).length : 0;
        
        const totalMatches = textMatches + htmlMatches;
        
        if (totalMatches > 0) {
          const matchScore = Math.min(totalMatches * weight, weight * 3); // Cap multiplier
          score += matchScore;
          matches.push({
            pattern: text,
            textMatches,
            htmlMatches,
            score: matchScore
          });
        }
      }
      
      results[pageType] = { score, matches };
    }
    
    // Find best match
    let bestType = 'unknown';
    let bestScore = 0;
    
    for (const [pageType, result] of Object.entries(results)) {
      if (result.score > bestScore && result.score > 2) { // Minimum threshold
        bestScore = result.score;
        bestType = pageType;
      }
    }
    
    this.logDebug(`Content analysis match: ${bestType} (${bestScore})`, results[bestType]);
    return bestType;
  }

  async detectByMetadata() {
    const metadata = {
      title: document.title.toLowerCase(),
      description: this.getMetaContent('description')?.toLowerCase() || '',
      keywords: this.getMetaContent('keywords')?.toLowerCase() || '',
      ogType: this.getMetaContent('og:type')?.toLowerCase() || '',
      canonical: this.getCanonicalUrl() || ''
    };
    
    // Meta-based detection rules
    const metaRules = {
      product: [
        { field: 'title', patterns: ['part', 'product', 'item'] },
        { field: 'ogType', patterns: ['product'] },
        { field: 'canonical', patterns: ['/product/', '/p/', '/item/'] }
      ],
      search: [
        { field: 'title', patterns: ['search', 'results'] },
        { field: 'canonical', patterns: ['/search', '?search=', '?q='] }
      ],
      category: [
        { field: 'title', patterns: ['category', 'parts', 'racing'] },
        { field: 'canonical', patterns: ['/category/', '/c/'] }
      ],
      cart: [
        { field: 'title', patterns: ['cart', 'shopping'] },
        { field: 'canonical', patterns: ['/cart', '/shopping'] }
      ]
    };
    
    let bestType = 'unknown';
    let bestScore = 0;
    
    for (const [pageType, rules] of Object.entries(metaRules)) {
      let score = 0;
      
      for (const rule of rules) {
        const fieldValue = metadata[rule.field] || '';
        for (const pattern of rule.patterns) {
          if (fieldValue.includes(pattern)) {
            score += 1;
          }
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestType = pageType;
      }
    }
    
    this.logDebug(`Metadata match: ${bestType} (${bestScore})`);
    return bestScore > 0 ? bestType : 'unknown';
  }

  /**
   * ENHANCED ELEMENT MAPPING
   */
  
  async getPageElementsSafe(pageType) {
    try {
      return await this.getPageElements(pageType);
    } catch (error) {
      console.warn(`[PageDetector] Element mapping failed for ${pageType}:`, error);
      return {};
    }
  }

  async getPageElements(pageType) {
    const elementMap = this.elementMaps[pageType];
    if (!elementMap) {
      this.logDebug(`No element map for page type: ${pageType}`);
      return {};
    }

    const elements = {};
    const elementPromises = [];
    
    // Process elements in parallel
    for (const [elementName, selectors] of Object.entries(elementMap)) {
      elementPromises.push(
        this.findElementWithFallbacks(elementName, selectors)
      );
    }
    
    const results = await Promise.allSettled(elementPromises);
    
    results.forEach((result, index) => {
      const elementName = Object.keys(elementMap)[index];
      if (result.status === 'fulfilled' && result.value) {
        elements[elementName] = result.value;
      }
    });

    this.pageElements.set(pageType, elements);
    this.logDebug(`Found ${Object.keys(elements).length} elements for ${pageType}`);
    return elements;
  }

  async findElementWithFallbacks(elementName, selectors) {
    const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
    
    for (const selector of selectorArray) {
      try {
        const element = await this.waitForElement(selector, 2000);
        if (element) {
          return {
            element: element,
            selector: selector,
            visible: this.isElementVisible(element),
            interactive: this.isElementInteractive(element),
            rect: element.getBoundingClientRect(),
            attributes: this.getElementAttributes(element),
            score: this.calculateElementScore(element)
          };
        }
      } catch (error) {
        this.logDebug(`Element selector failed: ${selector}`, error.message);
      }
    }
    
    return null;
  }

  calculateElementScore(element) {
    let score = 1;
    
    // Bonus for visibility
    if (this.isElementVisible(element)) score += 0.5;
    
    // Bonus for interactivity
    if (this.isElementInteractive(element)) score += 0.3;
    
    // Bonus for size
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) score += 0.2;
    
    // Penalty for being hidden or very small
    if (rect.width < 10 || rect.height < 10) score -= 0.5;
    
    return Math.max(0, score);
  }

  async getElement(elementName, pageType = null) {
    const currentPageType = pageType || this.currentPage?.type;
    if (!currentPageType) {
      throw new Error('Page type not detected');
    }

    // Check cache first
    const cacheKey = `${currentPageType}_${elementName}`;
    const cached = this.pageElements.get(currentPageType)?.[elementName];
    
    if (cached && this.isElementStillValid(cached.element)) {
      return cached;
    }

    // Re-fetch elements for this page type
    const pageElements = await this.getPageElements(currentPageType);
    const elementInfo = pageElements[elementName];
    
    if (!elementInfo) {
      throw new Error(`Element '${elementName}' not found on ${currentPageType} page`);
    }

    return elementInfo;
  }

  isElementStillValid(element) {
    return element && 
           document.contains(element) && 
           this.isElementVisible(element);
  }

  /**
   * ENHANCED STATE ANALYSIS
   */
  
  async analyzePageStateSafe(pageType) {
    try {
      return await this.analyzePageState(pageType);
    } catch (error) {
      console.warn(`[PageDetector] State analysis failed for ${pageType}:`, error);
      return this.getBasicPageState();
    }
  }

  getBasicPageState() {
    return {
      loading: this.isPageLoading(),
      interactive: document.readyState === 'interactive' || document.readyState === 'complete',
      scrollPosition: window.pageYOffset,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      timestamp: Date.now()
    };
  }

  async analyzePageState(pageType) {
    const state = this.getBasicPageState();

    // Enhanced page-specific analysis
    const analyzers = {
      search: () => this.analyzeSearchResults(),
      product: () => this.analyzeProductInfo(),
      category: () => this.analyzeCategoryInfo(),
      cart: () => this.analyzeCartInfo(),
      homepage: () => this.analyzeHomepageInfo()
    };

    if (analyzers[pageType]) {
      try {
        const specificState = await analyzers[pageType]();
        Object.assign(state, { [pageType]: specificState });
      } catch (error) {
        console.warn(`[PageDetector] Specific analysis failed for ${pageType}:`, error);
      }
    }

    return state;
  }

  async analyzeSearchResults() {
    const results = document.querySelectorAll(
      '[data-testid="product-tile"], .product-item, .search-result-item, .product-card, .result-item'
    );
    
    const pagination = document.querySelector(
      '.pagination, .pager, .page-numbers, .pagination-wrapper'
    );
    
    const filters = document.querySelectorAll(
      '.filter-item, .facet, .filter-option, .refinement'
    );
    
    const sortOptions = document.querySelector(
      '.sort-select, .sort-dropdown, .sort-options'
    );
    
    return {
      resultCount: results.length,
      hasResults: results.length > 0,
      hasPagination: !!pagination,
      filterCount: filters.length,
      hasSortOptions: !!sortOptions,
      currentPage: this.extractCurrentPage(),
      totalPages: this.extractTotalPages(),
      searchQuery: this.extractSearchQuery(),
      resultCountText: this.extractResultCountText()
    };
  }

  async analyzeProductInfo() {
    const title = document.querySelector(
      'h1, .product-title, [data-testid="product-title"], .product-name, .item-title'
    );
    
    const price = document.querySelector(
      '.price, .product-price, [data-testid="price"], .price-current, .cost'
    );
    
    const stock = document.querySelector(
      '.stock, .availability, .in-stock, .stock-status, .inventory'
    );
    
    const addToCart = document.querySelector(
      '.add-to-cart, [data-testid="add-to-cart"], .btn-add-cart, .add-to-bag'
    );
    
    const images = document.querySelectorAll(
      '.product-image img, .product-gallery img, .item-image img'
    );
    
    return {
      hasTitle: !!title,
      hasPrice: !!price,
      hasStock: !!stock,
      canAddToCart: !!addToCart && !addToCart.disabled,
      imageCount: images.length,
      productId: this.extractProductId(),
      partNumber: this.extractPartNumber(),
      brand: this.extractProductBrand(),
      category: this.extractProductCategory(),
      price: this.extractPrice(price),
      stockStatus: this.extractStockStatus(stock)
    };
  }

  async analyzeHomepageInfo() {
    const hero = document.querySelector('.hero, .banner, .main-banner, .hero-section');
    const featuredProducts = document.querySelectorAll('.featured-product, .hero-product');
    const categories = document.querySelectorAll('.category-item, .category-link');
    const promos = document.querySelectorAll('.promo, .promotion, .special-offer');
    
    return {
      hasHero: !!hero,
      featuredProductCount: featuredProducts.length,
      categoryCount: categories.length,
      promoCount: promos.length,
      hasSearchBar: !!document.querySelector('#search, .search-input, .search-box'),
      hasNavigation: !!document.querySelector('.main-nav, .navigation, .menu')
    };
  }

  /**
   * INITIALIZATION METHODS - ENHANCED
   */
  
  initUrlPatterns() {
    return {
      homepage: [
        /^https?:\/\/(?:www\.)?speedwaymotors\.com\/?$/,
        /^https?:\/\/(?:www\.)?speedwaymotors\.com\/(?:index|home)/,
        /^https?:\/\/localhost:\d+\/?$/
      ],
      search: [
        /\/search/i,
        /\/results/i,
        /[?&](?:search|q|query)=/i,
        /\/find\//i,
        /\/lookup/i
      ],
      product: [
        /\/product\//i,
        /\/p\//i,
        /\/items?\//i,
        /\/parts?\//i,
        /\/detail\//i,
        /\/sku\//i
      ],
      category: [
        /\/categor(?:y|ies)\//i,
        /\/c\//i,
        /\/parts\//i,
        /\/racing\//i,
        /\/shop\//i,
        /\/browse\//i
      ],
      cart: [
        /\/cart/i,
        /\/shopping-cart/i,
        /\/basket/i,
        /\/bag/i
      ],
      checkout: [
        /\/checkout/i,
        /\/payment/i,
        /\/billing/i,
        /\/order/i,
        /\/purchase/i
      ],
      account: [
        /\/account/i,
        /\/profile/i,
        /\/login/i,
        /\/register/i,
        /\/user/i,
        /\/my-account/i
      ],
      support: [
        /\/support/i,
        /\/help/i,
        /\/contact/i,
        /\/faq/i,
        /\/customer-service/i
      ],
      blog: [
        /\/blog/i,
        /\/news/i,
        /\/articles/i,
        /\/posts/i
      ]
    };
  }

  initElementMaps() {
    return {
      homepage: {
        searchBar: [
          '#search-input', 
          '.search-box input', 
          '[data-testid="search-input"]',
          'input[name="search"]',
          '.header-search input',
          '.search-field input',
          '.site-search input'
        ],
        searchButton: [
          '#search-button', 
          '.search-btn', 
          '[data-testid="search-btn"]',
          '.search-box button',
          'button[type="submit"]',
          '.search-submit',
          '.search-go'
        ],
        categoryMenu: [
          '.category-nav', 
          '.main-nav', 
          '.navigation',
          '.menu-categories',
          '.shop-menu',
          '.primary-nav',
          '.site-nav'
        ],
        featuredProducts: [
          '.featured-products', 
          '.hero-products', 
          '.product-highlights',
          '.featured-items',
          '.spotlight-products'
        ]
      },
      search: {
        searchResults: [
          '.search-results', 
          '.product-grid', 
          '.results-container',
          '.products-list',
          '.search-products',
          '.result-list',
          '.product-listing'
        ],
        resultItems: [
          '.product-item', 
          '.product-tile', 
          '[data-testid="product-tile"]',
          '.product-card',
          '.search-result',
          '.result-item',
          '.product-listing-item'
        ],
        pagination: [
          '.pagination', 
          '.pager', 
          '.page-numbers',
          '.pagination-wrapper',
          '.page-nav'
        ],
        filters: [
          '.filters', 
          '.facets', 
          '.filter-panel',
          '.sidebar-filters',
          '.refinements',
          '.filter-options'
        ],
        sortDropdown: [
          '.sort-select', 
          '.sort-dropdown', 
          '[data-testid="sort"]',
          'select[name="sort"]',
          '.sort-options select'
        ]
      },
      product: {
        productTitle: [
          'h1', 
          '.product-title', 
          '[data-testid="product-title"]',
          '.product-name',
          '.item-title',
          '.product-heading'
        ],
        productPrice: [
          '.price', 
          '.product-price', 
          '[data-testid="price"]',
          '.price-current',
          '.cost',
          '.product-cost',
          '.price-box'
        ],
        addToCartButton: [
          '.add-to-cart', 
          '[data-testid="add-to-cart"]', 
          '.btn-add-cart',
          'button[data-action="add-to-cart"]',
          '.add-to-bag',
          '.purchase-btn',
          '.buy-now'
        ],
        quantityInput: [
          '.quantity-input', 
          'input[name="quantity"]', 
          '[data-testid="quantity"]',
          '.qty-input',
          '.product-quantity input'
        ],
        productImages: [
          '.product-images', 
          '.image-gallery', 
          '.product-photos',
          '.product-gallery',
          '.item-images'
        ]
      },
      category: {
        productGrid: [
          '.product-grid', 
          '.products-container', 
          '.category-products',
          '.products-list',
          '.product-listing'
        ],
        productItems: [
          '.product-item', 
          '.product-tile', 
          '.product-card',
          '.category-item'
        ],
        categoryFilter: [
          '.category-filters', 
          '.category-nav', 
          '.subcategories',
          '.category-refinements'
        ],
        breadcrumbs: [
          '.breadcrumbs', 
          '.breadcrumb', 
          '.navigation-path',
          '.page-path'
        ]
      },
      cart: {
        cartItems: [
          '.cart-items', 
          '.line-items', 
          '.shopping-cart-items',
          '.cart-products'
        ],
        cartItem: [
          '.cart-item', 
          '.line-item', 
          '.cart-product',
          '.shopping-item'
        ],
        checkoutButton: [
          '.checkout-btn', 
          '[data-testid="checkout"]', 
          '.proceed-checkout',
          '.btn-checkout',
          '.continue-checkout'
        ],
        total: [
          '.total', 
          '.cart-total', 
          '.grand-total',
          '.order-total'
        ]
      }
    };
  }

  initPageIndicators() {
    return {
      homepage: [
        { selector: '.hero-banner, .main-banner, .home-hero, .hero-section', weight: 1 },
        { selector: '.featured-products, .featured-items, .hero-products', weight: 0.8 },
        { selector: '.category-nav, .main-nav, .shop-categories', weight: 0.8 },
        { selector: '.search-box, .site-search, #search', weight: 0.7 }
      ],
      search: [
        { selector: '.search-results, .results-container, .product-listing', weight: 1 },
        { selector: '.filter-panel, .filters, .refinements', weight: 0.8 },
        { selector: '.pagination, .pager, .page-numbers', weight: 0.6 },
        { selector: '.sort-options, .sort-dropdown', weight: 0.5 }
      ],
      product: [
        { selector: '.add-to-cart, .btn-add-cart, .purchase-btn', weight: 1 },
        { selector: '.product-images, .image-gallery, .product-photos', weight: 0.9 },
        { selector: '.part-number, .sku, .product-code', weight: 0.8 },
        { selector: '.quantity-input, .qty-selector', weight: 0.7 }
      ],
      category: [
        { selector: '.product-grid, .products-container, .product-listing', weight: 1 },
        { selector: '.category-filters, .filters, .refinements', weight: 0.8 },
        { selector: '.breadcrumbs, .breadcrumb, .navigation-path', weight: 0.6 },
        { selector: '.subcategories, .category-nav', weight: 0.5 }
      ],
      cart: [
        { selector: '.cart-items, .shopping-cart-items, .line-items', weight: 1 },
        { selector: '.checkout-btn, .proceed-checkout, .continue-checkout', weight: 0.9 },
        { selector: '.cart-total, .total, .grand-total', weight: 0.8 },
        { selector: '.quantity-input, .qty-input', weight: 0.6 }
      ]
    };
  }

  initContentPatterns() {
    return {
      homepage: [
        { text: 'race car parts', weight: 1 },
        { text: 'performance parts', weight: 1 },
        { text: 'speedway motors', weight: 1 },
        { text: 'featured products', weight: 0.8 },
        { text: 'shop by category', weight: 0.8 },
        { text: 'welcome to', weight: 0.6 },
        { html: 'class="hero"', weight: 0.5 }
      ],
      search: [
        { text: 'search results', weight: 1 },
        { text: 'results for', weight: 1 },
        { text: 'showing', weight: 0.8 },
        { text: 'filter', weight: 0.8 },
        { text: 'sort by', weight: 0.8 },
        { text: 'refine', weight: 0.6 },
        { html: 'class="search', weight: 0.5 }
      ],
      product: [
        { text: 'add to cart', weight: 1 },
        { text: 'part number', weight: 1 },
        { text: 'specifications', weight: 0.8 },
        { text: 'product details', weight: 0.8 },
        { text: 'quantity', weight: 0.7 },
        { text: 'in stock', weight: 0.6 },
        { text: 'price', weight: 0.5 }
      ],
      category: [
        { text: 'products', weight: 0.8 },
        { text: 'categories', weight: 0.8 },
        { text: 'view all', weight: 0.6 },
        { text: 'subcategory', weight: 0.7 },
        { text: 'browse', weight: 0.5 },
        { html: 'class="category', weight: 0.4 }
      ],
      cart: [
        { text: 'shopping cart', weight: 1 },
        { text: 'checkout', weight: 1 },
        { text: 'total', weight: 0.8 },
        { text: 'quantity', weight: 0.8 },
        { text: 'remove', weight: 0.6 },
        { text: 'update cart', weight: 0.6 },
        { text: 'subtotal', weight: 0.5 }
      ],
      checkout: [
        { text: 'billing', weight: 1 },
        { text: 'shipping', weight: 1 },
        { text: 'payment', weight: 1 },
        { text: 'place order', weight: 0.9 },
        { text: 'order summary', weight: 0.8 }
      ]
    };
  }

  /**
   * CACHING AND PERFORMANCE
   */
  
  getCachedDetection() {
    const url = window.location.href;
    const cached = this.detectionCache.get(url);
    
    if (cached && Date.now() - cached.timestamp < this.options.cacheTimeout) {
      this.logDebug('Using cached detection for:', url);
      return { ...cached.result, fromCache: true };
    }
    
    return null;
  }

  cacheDetection(result) {
    const url = window.location.href;
    this.detectionCache.set(url, {
      result: { ...result },
      timestamp: Date.now()
    });
    
    // Cleanup old cache entries
    this.cleanupCache();
  }

  cleanupCache() {
    const now = Date.now();
    const maxAge = this.options.cacheTimeout;
    
    for (const [url, entry] of this.detectionCache) {
      if (now - entry.timestamp > maxAge) {
        this.detectionCache.delete(url);
      }
    }
    
    // Limit cache size
    if (this.detectionCache.size > 50) {
      const entries = Array.from(this.detectionCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Remove oldest half
      for (let i = 0; i < entries.length / 2; i++) {
        this.detectionCache.delete(entries[i][0]);
      }
    }
  }

  resolveQueuedDetections(result) {
    while (this.detectionQueue.length > 0) {
      const resolve = this.detectionQueue.shift();
      resolve({ ...result, fromQueue: true });
    }
  }

  updatePerformanceStats(duration) {
    this.performanceStats.detections++;
    
    // Update rolling average
    const currentAvg = this.performanceStats.avgDetectionTime;
    const count = this.performanceStats.detections;
    this.performanceStats.avgDetectionTime = 
      (currentAvg * (count - 1) + duration) / count;
    
    this.lastDetectionTime = Date.now();
    
    if (this.options.debug) {
      console.log(`[PageDetector] Detection completed in ${duration}ms (avg: ${this.performanceStats.avgDetectionTime.toFixed(1)}ms)`);
    }
  }

  getFallbackDetection(error) {
    return {
      url: window.location.href,
      pathname: window.location.pathname,
      type: 'unknown',
      confidence: 0,
      error: error.message,
      timestamp: Date.now(),
      elements: {},
      state: this.getBasicPageState(),
      metadata: { title: document.title }
    };
  }

  /**
   * ENHANCED UTILITY METHODS
   */
  
  async waitForElement(selector, timeout = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          if (this.isElementVisible(element)) {
            return element;
          }
        }
      } catch (error) {
        // Invalid selector, continue
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
        const handler = () => {
          document.removeEventListener('DOMContentLoaded', handler);
          resolve();
        };
        document.addEventListener('DOMContentLoaded', handler);
      } else {
        resolve();
      }
    });
  }

  isElementVisible(element) {
    if (!element) return false;
    
    try {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || 
          style.visibility === 'hidden' || 
          style.opacity === '0') return false;
      
      // Check if element is in viewport (at least partially)
      const viewport = {
        top: 0,
        left: 0,
        bottom: window.innerHeight,
        right: window.innerWidth
      };
      
      return !(rect.bottom < viewport.top || 
               rect.top > viewport.bottom || 
               rect.right < viewport.left || 
               rect.left > viewport.right);
      
    } catch (error) {
      return false;
    }
  }

  isElementInteractive(element) {
    if (!element) return false;
    
    try {
      const style = window.getComputedStyle(element);
      const tagName = element.tagName.toLowerCase();
      
      if (element.disabled || style.pointerEvents === 'none') return false;
      
      return tagName === 'button' || 
             tagName === 'input' || 
             tagName === 'select' || 
             tagName === 'textarea' || 
             tagName === 'a' || 
             element.onclick ||
             element.getAttribute('role') === 'button' ||
             element.hasAttribute('tabindex');
    } catch (error) {
      return false;
    }
  }

  getElementAttributes(element) {
    const attrs = {};
    try {
      for (const attr of element.attributes) {
        attrs[attr.name] = attr.value;
      }
    } catch (error) {
      // Ignore attribute errors
    }
    return attrs;
  }

  combineDetectionResults(results) {
    let bestType = 'unknown';
    let bestScore = 0;
    let combinedConfidence = 0;
    let methodCount = 0;
    
    // Weighted combination of all detection methods
    for (const [method, result] of Object.entries(results)) {
      if (result.type !== 'unknown' && !result.error) {
        const weightedScore = result.confidence;
        combinedConfidence += weightedScore;
        methodCount++;
        
        if (weightedScore > bestScore) {
          bestScore = weightedScore;
          bestType = result.type;
        }
      }
    }
    
    // Normalize confidence
    const finalConfidence = methodCount > 0 ? combinedConfidence / methodCount : 0;
    
    return {
      type: bestType,
      subtype: null,
      confidence: finalConfidence,
      methods: results
    };
  }

  /**
   * AUTO-DETECTION WITH ENHANCED MONITORING
   */
  
  startAutoDetection() {
    // Listen for navigation changes
    window.addEventListener('popstate', () => {
      this.debouncedDetection();
    });
    
    // Enhanced history override with error handling
    this.setupHistoryOverrides();
    
    // Monitor DOM changes with throttling
    this.startDomObserver();
    
    // Monitor page load events
    this.setupPageLoadMonitoring();
  }

  setupHistoryOverrides() {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = (...args) => {
      try {
        originalPushState.apply(history, args);
        this.debouncedDetection();
      } catch (error) {
        console.error('[PageDetector] PushState error:', error);
      }
    };
    
    history.replaceState = (...args) => {
      try {
        originalReplaceState.apply(history, args);
        this.debouncedDetection();
      } catch (error) {
        console.error('[PageDetector] ReplaceState error:', error);
      }
    };
  }

  startDomObserver() {
    let lastChange = 0;
    const throttleDelay = 2000; // Throttle DOM changes
    
    const observer = new MutationObserver((mutations) => {
      const now = Date.now();
      if (now - lastChange < throttleDelay) return;
      
      let significantChange = false;
      
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check for significant content changes
              const className = node.className || '';
              const id = node.id || '';
              
              if (className.includes('main') || 
                  className.includes('content') || 
                  className.includes('page') ||
                  id.includes('main') ||
                  id.includes('content')) {
                significantChange = true;
                break;
              }
            }
          }
        }
      }
      
      if (significantChange) {
        lastChange = now;
        this.debouncedDetection();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false // Reduce noise
    });

    this.observers.set('dom', observer);
  }

  setupPageLoadMonitoring() {
    // Monitor various page load events
    const events = ['load', 'DOMContentLoaded'];
    
    events.forEach(eventType => {
      window.addEventListener(eventType, () => {
        setTimeout(() => this.debouncedDetection(), 500);
      });
    });
  }

  // Callback management với size limits
  onPageChange(callback) {
    const id = Date.now() + Math.random();
    this.callbacks.set(id, callback);
    
    // Limit callback storage
    if (this.callbacks.size > 20) {
      const firstKey = this.callbacks.keys().next().value;
      this.callbacks.delete(firstKey);
    }
    
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
        console.error('[PageDetector] Callback error:', error);
      }
    }
  }

  /**
   * EXTRACTION HELPERS - ENHANCED
   */
  
  extractProductId() {
    // Try multiple extraction methods
    const methods = [
      () => {
        const url = window.location.pathname;
        const match = url.match(/\/product\/([^\/]+)|\/p\/([^\/]+)|\/item\/([^\/]+)/);
        return match ? (match[1] || match[2] || match[3]) : null;
      },
      () => document.querySelector('[data-product-id]')?.getAttribute('data-product-id'),
      () => document.querySelector('[data-item-id]')?.getAttribute('data-item-id'),
      () => {
        const meta = document.querySelector('meta[property="product:retailer_item_id"]');
        return meta?.getAttribute('content');
      }
    ];
    
    for (const method of methods) {
      try {
        const result = method();
        if (result) return result;
      } catch (error) {
        // Continue to next method
      }
    }
    
    return null;
  }

  extractPartNumber() {
    const selectors = [
      '.part-number', '.sku', '.product-code', 
      '[data-part-number]', '[data-sku]',
      '.item-number', '.model-number'
    ];
    
    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent.trim();
          // Clean up part number (remove labels)
          const cleaned = text.replace(/^(part|sku|item|model)[\s#:]+/i, '');
          if (cleaned) return cleaned;
        }
      } catch (error) {
        // Continue to next selector
      }
    }
    
    return null;
  }

  extractPrice(priceElement) {
    if (!priceElement) return null;
    
    const text = priceElement.textContent;
    const match = text.match(/[\$]?([\d,]+\.?\d*)/);
    return match ? parseFloat(match[1].replace(',', '')) : null;
  }

  extractStockStatus(stockElement) {
    if (!stockElement) return null;
    
    const text = stockElement.textContent.toLowerCase();
    if (text.includes('in stock')) return 'in_stock';
    if (text.includes('out of stock')) return 'out_of_stock';
    if (text.includes('limited')) return 'limited';
    if (text.includes('backorder')) return 'backorder';
    
    return 'unknown';
  }

  extractSearchQuery() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('q') || 
           urlParams.get('search') || 
           urlParams.get('query') || 
           urlParams.get('keyword') || '';
  }

  extractResultCountText() {
    const selectors = [
      '.result-count', '.search-count', '.total-results', 
      '.results-info', '.result-summary'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element.textContent.trim();
    }
    
    return '';
  }

  extractCurrentPage() {
    const pageText = document.body.textContent;
    const match = pageText.match(/page\s+(\d+)/i);
    return match ? parseInt(match[1]) : 1;
  }

  extractTotalPages() {
    const pagination = document.querySelector('.pagination, .pager');
    if (!pagination) return 1;
    
    const links = pagination.querySelectorAll('a, span');
    let maxPage = 1;
    
    for (const link of links) {
      const text = link.textContent.trim();
      const num = parseInt(text);
      if (!isNaN(num) && num > maxPage) {
        maxPage = num;
      }
    }
    
    return maxPage;
  }

  getMetaContent(name) {
    const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
    return meta?.getAttribute('content') || null;
  }

  getCanonicalUrl() {
    const canonical = document.querySelector('link[rel="canonical"]');
    return canonical?.getAttribute('href') || null;
  }

  isPageLoading() {
    return document.readyState === 'loading' || 
           document.querySelector('.loading, .spinner, .loader') !== null;
  }

  async extractPageMetadataSafe(pageType) {
    try {
      return await this.extractPageMetadata(pageType);
    } catch (error) {
      console.warn('[PageDetector] Metadata extraction failed:', error);
      return { title: document.title };
    }
  }

  async extractPageMetadata(pageType) {
    const metadata = {
      title: document.title,
      description: this.getMetaContent('description'),
      keywords: this.getMetaContent('keywords'),
      canonical: this.getCanonicalUrl(),
      breadcrumbs: this.extractBreadcrumbs(),
      timestamp: Date.now()
    };

    // Page-specific metadata
    const extractors = {
      product: () => ({
        name: this.extractProductName(),
        sku: this.extractProductSku(),
        brand: this.extractProductBrand(),
        category: this.extractProductCategory()
      }),
      search: () => ({
        query: this.extractSearchQuery(),
        resultCount: this.extractSearchResultCount()
      }),
      category: () => ({
        name: this.extractCategoryName(),
        level: this.extractCategoryLevel()
      })
    };

    if (extractors[pageType]) {
      try {
        metadata[pageType] = extractors[pageType]();
      } catch (error) {
        console.warn(`[PageDetector] ${pageType} metadata extraction failed:`, error);
      }
    }

    return metadata;
  }

  extractBreadcrumbs() {
    const breadcrumbEl = document.querySelector('.breadcrumbs, .breadcrumb, .navigation-path');
    if (!breadcrumbEl) return [];
    
    const links = breadcrumbEl.querySelectorAll('a, span');
    return Array.from(links)
      .map(link => link.textContent.trim())
      .filter(text => text && text !== '>' && text !== '/');
  }

  /**
   * UTILITY AND DEBUGGING
   */
  
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  withTimeout(promise, timeout) {
    return Promise.race([
      promise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), timeout)
      )
    ]);
  }

  // Enhanced debug mode
  enableDebugMode() {
    this.createDebugPanel();
    this.onPageChange((pageInfo) => {
      this.updateDebugPanel(pageInfo);
    });
    
    // Log performance stats periodically
    setInterval(() => {
      if (this.performanceStats.detections > 0) {
        console.log('[PageDetector] Performance Stats:', this.performanceStats);
      }
    }, 30000);
  }

  createDebugPanel() {
    const panel = document.createElement('div');
    panel.id = 'page-detector-debug';
    panel.style.cssText = `
      position: fixed;
      bottom: 10px;
      left: 10px;
      width: 380px;
      max-height: 350px;
      background: rgba(0,0,0,0.9);
      color: white;
      padding: 15px;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      z-index: 999999;
      overflow-y: auto;
      border: 1px solid #333;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(panel);
    this.debugPanel = panel;
  }

  updateDebugPanel(pageInfo) {
    if (!this.debugPanel) return;
    
    const stats = this.performanceStats;
    
    this.debugPanel.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px; color: #4CAF50;">🔍 Page Detection Debug</div>
      <div><strong>Type:</strong> ${pageInfo.type} (${(pageInfo.confidence * 100).toFixed(1)}%)</div>
      <div><strong>URL:</strong> ${pageInfo.pathname}</div>
      <div><strong>Elements:</strong> ${Object.keys(pageInfo.elements || {}).length}</div>
      <div><strong>Cache:</strong> ${pageInfo.fromCache ? 'HIT' : 'MISS'}</div>
      <div style="margin-top: 8px;"><strong>Performance:</strong></div>
      <div>• Detections: ${stats.detections} | Cache: ${stats.cacheHits}</div>
      <div>• Avg Time: ${stats.avgDetectionTime.toFixed(1)}ms | Errors: ${stats.errors}</div>
      <div style="margin-top: 8px;"><strong>Available Elements:</strong></div>
      <div style="font-size: 10px; opacity: 0.8; max-height: 60px; overflow-y: auto;">
        ${Object.keys(pageInfo.elements || {}).join(', ') || 'None'}
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

  // Enhanced cleanup
  destroy() {
    // Stop all observers
    for (const observer of this.observers.values()) {
      observer.disconnect();
    }
    
    // Clear all data structures
    this.observers.clear();
    this.callbacks.clear();
    this.pageElements.clear();
    this.detectionCache.clear();
    
    // Clear detection queue
    this.detectionQueue.forEach(resolve => 
      resolve(this.getFallbackDetection(new Error('Detector destroyed')))
    );
    this.detectionQueue = [];
    
    // Remove debug panel
    if (this.debugPanel && this.debugPanel.parentNode) {
      this.debugPanel.parentNode.removeChild(this.debugPanel);
    }
    
    console.log('[PageDetector] Enhanced page detector destroyed and cleaned up');
  }

  // Public API for getting performance stats
  getPerformanceStats() {
    return { ...this.performanceStats };
  }

  // Public API for manual cache clearing
  clearCache() {
    this.detectionCache.clear();
    console.log('[PageDetector] Detection cache cleared');
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PageDetector;
} else if (typeof window !== 'undefined') {
  window.PageDetector = PageDetector;
}

console.log('[PageDetector] Enhanced page detector loaded successfully');