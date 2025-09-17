/**
 * @fileoverview Main JavaScript for the link generator page.
 * Handles fetching proxy lists, creating configuration links, and generating QR codes.
 */

// --- CONFIGURATION --- //

/**
 * Configuration constants for the application.
 * @const
 */
const CONFIG = {
    DEFAULT_PROXY_URL: 'https://raw.githubusercontent.com/AFRcloud/ProxyList/refs/heads/main/ProxyList.txt',
    SERVER_DOMAINS: ['siren.afrcloud.site', 'afrcloud.biz.id'],
    DEFAULT_UUID: 'bbbbbbbb-cccc-4ddd-eeee-ffffffffffff',
    ITEMS_PER_PAGE: 10,
    PATH_TEMPLATE: '/{ip}-{port}',
    BUG_OPTIONS: [
        { value: '', label: 'Default' },
        { value: 'support.zoom.us', label: 'ZOOM' },
        { value: 'zoomgov.com', label: 'ZOOMGOV' },
        { value: 'ava.game.naver.com', label: 'WLG' },
        { value: 'graph.instagram.com', label: 'IG' },
        { value: 'manual', label: 'Manual Input' } // Added for manual bug entry
    ],
    STATUS_CHECK_URL: 'https://api.jb8fd7grgd.workers.dev/'
};

// --- STATE --- //

let proxyList = [];
let filteredProxyList = [];
let selectedProxy = null;
let selectedServerDomain = CONFIG.SERVER_DOMAINS[0];
let currentPage = 1;

// --- DOM ELEMENTS --- //

const dom = {
    proxyListSection: document.getElementById('proxy-list-section'),
    accountCreationSection: document.getElementById('account-creation-section'),
    resultSection: document.getElementById('result-section'),
    loadingIndicator: document.getElementById('loading-indicator'),
    proxyListContainer: document.getElementById('proxy-list-container'),
    noProxiesMessage: document.getElementById('no-proxies-message'),
    customUrlInputContainer: document.getElementById('custom-url-input'),
    proxyUrlInput: document.getElementById('proxy-url'),
    paginationContainer: document.getElementById('pagination-container'),
    proxyCountInfo: document.getElementById('proxy-count-info'),
    searchInput: document.getElementById('search-input'),
    connectionUrl: document.getElementById('connection-url'),
    qrcode: document.getElementById('qrcode')
};

// --- INITIALIZATION --- //

document.addEventListener('DOMContentLoaded', () => {
    displayFallbackProxyList();
    loadProxyList(CONFIG.DEFAULT_PROXY_URL);
    setupEventListeners();
    populateAllDropdowns();
});

/**
 * Sets up all event listeners for the page.
 */
function setupEventListeners() {
    document.getElementById('refresh-btn').addEventListener('click', () => loadProxyList(CONFIG.DEFAULT_PROXY_URL));
    document.getElementById('custom-url-btn').addEventListener('click', () => dom.customUrlInputContainer.classList.toggle('hidden'));
    document.getElementById('load-custom-url').addEventListener('click', () => {
        const url = dom.proxyUrlInput.value.trim();
        if (url) loadProxyList(url);
    });

    // Navigation buttons
    document.getElementById('back-to-list').addEventListener('click', showProxyListSection);
    document.getElementById('back-to-form').addEventListener('click', showAccountCreationSection);
    document.getElementById('create-new').addEventListener('click', showAccountCreationSection);
    document.getElementById('back-to-list-from-result').addEventListener('click', showProxyListSection);

    // Search
    dom.searchInput.addEventListener('input', handleSearch);

    // Protocol Tabs
    const protocolTabs = document.querySelectorAll('.tab-btn');
    protocolTabs.forEach(tab => tab.addEventListener('click', () => handleTabClick(tab, protocolTabs)));

    // Form Submissions
    document.querySelectorAll('.protocol-form').forEach(form => form.addEventListener('submit', handleFormSubmit));

    // Result buttons
    document.getElementById('copy-url').addEventListener('click', handleCopyUrl);
    document.getElementById('download-qr').addEventListener('click', downloadQRCode);
}

/**
 * Populates all dropdown menus on the page.
 */
function populateAllDropdowns() {
    populateDropdown('.server-domain-select', CONFIG.SERVER_DOMAINS.map(domain => ({ value: domain, label: domain })));
    populateDropdown('.bug-select', CONFIG.BUG_OPTIONS);
    setupBugSelectListeners();
}

// --- UI & STATE MANAGEMENT --- //

function showProxyListSection() {
    dom.proxyListSection.classList.remove('hidden');
    dom.accountCreationSection.classList.add('hidden');
    dom.resultSection.classList.add('hidden');
}

function showAccountCreationSection() {
    dom.proxyListSection.classList.add('hidden');
    dom.accountCreationSection.classList.remove('hidden');
    dom.resultSection.classList.add('hidden');
}

function showResultSection() {
    dom.proxyListSection.classList.add('hidden');
    dom.accountCreationSection.classList.add('hidden');
    dom.resultSection.classList.remove('hidden');
}

/**
 * Handles the search input event to filter the proxy list.
 * @this {HTMLInputElement}
 */
function handleSearch() {
    const searchTerm = this.value.toLowerCase().trim();
    filteredProxyList = proxyList.filter(proxy => 
        proxy.provider.toLowerCase().includes(searchTerm) || 
        proxy.country.toLowerCase().includes(searchTerm)
    );
    currentPage = 1;
    renderProxyList();
}

/**
 * Handles clicks on protocol tabs.
 * @param {HTMLElement} clickedTab - The tab that was clicked.
 * @param {NodeListOf<HTMLElement>} allTabs - A NodeList of all tab elements.
 */
function handleTabClick(clickedTab, allTabs) {
    allTabs.forEach(t => t.classList.remove('active'));
    clickedTab.classList.add('active');

    document.querySelectorAll('.protocol-form').forEach(form => form.classList.add('hidden'));
    const targetId = clickedTab.getAttribute('data-target');
    document.getElementById(targetId).classList.remove('hidden');
}

// --- PROXY LIST HANDLING --- //

/**
 * Fetches and processes the proxy list from a given URL.
 * @param {string} url - The URL of the proxy list file.
 */
async function loadProxyList(url) {
    dom.loadingIndicator.classList.remove('hidden');
    dom.proxyListContainer.innerHTML = '';
    dom.noProxiesMessage.classList.add('hidden');

    const corsProxies = [
        (url) => fetch(url),
        (url) => fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`).then(res => res.json()).then(data => {
            if (!data.contents) throw new Error('CORS proxy failed to get contents');
            return { ok: true, text: () => Promise.resolve(data.contents) };
        }),
    ];

    for (const proxyFetch of corsProxies) {
        try {
            const response = await proxyFetch(url);
            if (!response.ok) throw new Error('Response not OK');
            const text = await response.text();
            processProxyData(text);
            dom.loadingIndicator.classList.add('hidden');
            return;
        } catch (error) {
            console.error('Fetch attempt failed:', error);
        }
    }

    console.error('All fetch attempts failed.');
    dom.loadingIndicator.classList.add('hidden');
    dom.noProxiesMessage.classList.remove('hidden');
    displayFallbackProxyList();
}


/**
 * Parses the raw text of the proxy list and updates the state.
 * @param {string} text - The raw text from the proxy list file.
 */
function processProxyData(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) {
        dom.noProxiesMessage.classList.remove('hidden');
        return;
    }

    const delimiter = detectDelimiter(lines[0]);
    proxyList = lines.map(line => {
        const parts = line.split(delimiter);
        if (parts.length >= 2) {
            return {
                ip: parts[0].trim(),
                port: parts[1].trim(),
                country: parts.length >= 3 ? parts[2].trim() : 'Unknown',
                provider: parts.length >= 4 ? parts[3].trim() : 'Unknown Provider',
            };
        }
        return null;
    }).filter(Boolean);

    if (proxyList.length === 0) {
        dom.noProxiesMessage.classList.remove('hidden');
        displayFallbackProxyList();
        return;
    }

    currentPage = 1;
    filteredProxyList = [...proxyList];
    renderProxyList();
}

/**
 * Renders the current page of the proxy list.
 */
function renderProxyList() {
    dom.proxyListContainer.innerHTML = '';

    if (filteredProxyList.length === 0) {
        dom.noProxiesMessage.classList.remove('hidden');
        dom.paginationContainer.innerHTML = '';
        dom.proxyCountInfo.textContent = '';
        return;
    }

    dom.noProxiesMessage.classList.add('hidden');

    const totalPages = Math.ceil(filteredProxyList.length / CONFIG.ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * CONFIG.ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + CONFIG.ITEMS_PER_PAGE, filteredProxyList.length);
    const currentItems = filteredProxyList.slice(startIndex, endIndex);

    currentItems.forEach((proxy, index) => {
        const actualIndex = startIndex + index;
        const card = createProxyCard(proxy, actualIndex);
        dom.proxyListContainer.appendChild(card);
        checkProxyStatusInList(proxy, card.querySelector('.status-badge'));
    });

    renderPagination(totalPages);
    dom.proxyCountInfo.textContent = `Showing ${startIndex + 1}-${endIndex} of ${filteredProxyList.length} proxies`;
}

/**
 * Creates an HTML element for a single proxy card.
 * @param {object} proxy - The proxy object.
 * @param {number} index - The index of the proxy in the filtered list.
 * @returns {HTMLElement} The created card element.
 */
function createProxyCard(proxy, index) {
    const card = document.createElement('div');
    card.className = 'proxy-card group';
    card.innerHTML = `
        <div class="flex justify-between items-center">
            <div class="flex-1 min-w-0 pr-2">
                <div class="flex items-center">
                    <div class="font-medium text-sm truncate group-hover:text-indigo-300 transition-colors">${proxy.provider}</div>
                    <span class="status-badge inline-block w-3 h-3 rounded-full bg-gray-500 ml-2 pulse-animation" title="Checking..."></span>
                </div>
                <div class="text-xs text-gray-400 mt-1 truncate group-hover:text-gray-300 transition-colors">
                    ${proxy.country} | ${proxy.ip}:${proxy.port}
                </div>
            </div>
            <div class="flex-shrink-0">
                <button class="create-account-btn primary-btn py-2 px-4 rounded-lg text-xs group-hover:scale-105 transition-transform" data-index="${index}">Create</button>
            </div>
        </div>
    `;
    card.querySelector('.create-account-btn').addEventListener('click', function() {
        selectProxy(parseInt(this.dataset.index, 10));
        showAccountCreationSection();
    });
    return card;
}

/**
 * Checks the status of a proxy and updates its badge in the list.
 * @param {object} proxy - The proxy object.
 * @param {HTMLElement} statusBadge - The badge element to update.
 */
async function checkProxyStatusInList(proxy, statusBadge) {
    try {
        const response = await fetch(`${CONFIG.STATUS_CHECK_URL}${proxy.ip}:${proxy.port}`);
        const data = await response.json();
        const proxyData = Array.isArray(data) ? data[0] : data;
        if (proxyData && proxyData.proxyip === true) {
            statusBadge.className = 'status-badge inline-block w-3 h-3 rounded-full bg-emerald-500 ml-2';
            statusBadge.title = 'Active';
        } else {
            statusBadge.className = 'status-badge inline-block w-3 h-3 rounded-full bg-rose-500 ml-2';
            statusBadge.title = 'Dead';
        }
    } catch (error) {
        statusBadge.className = 'status-badge inline-block w-3 h-3 rounded-full bg-amber-500 ml-2';
        statusBadge.title = 'Unknown';
        console.error('Fetch error:', error);
    }
}

/**
 * Renders pagination controls.
 * @param {number} totalPages - The total number of pages.
 */
function renderPagination(totalPages) {
    dom.paginationContainer.innerHTML = '';
    if (totalPages <= 1) return;

    const createButton = (text, page, disabled = false) => {
        const btn = document.createElement('button');
        btn.className = `pagination-btn ${currentPage === page ? 'active' : ''} ${disabled ? 'disabled' : ''}`;
        btn.innerHTML = text;
        btn.disabled = disabled;
        btn.addEventListener('click', () => {
            currentPage = page;
            renderProxyList();
        });
        return btn;
    };

    dom.paginationContainer.appendChild(createButton('<i class="fas fa-chevron-left"></i>', currentPage - 1, currentPage === 1));

    // Simplified pagination logic for brevity in this example
    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPage || (i >= currentPage - 1 && i <= currentPage + 1)) {
             dom.paginationContainer.appendChild(createButton(i, i));
        }
    }

    dom.paginationContainer.appendChild(createButton('<i class="fas fa-chevron-right"></i>', currentPage + 1, currentPage === totalPages));
}


/**
 * Populates a dropdown select element with options.
 * @param {string} selector - The CSS selector for the select element(s).
 * @param {Array<{value: string, label: string}>} options - The options to populate.
 */
function populateDropdown(selector, options) {
    document.querySelectorAll(selector).forEach(select => {
        select.innerHTML = '';
        options.forEach(optionData => {
            const option = document.createElement('option');
            option.value = optionData.value;
            option.textContent = optionData.label;
            select.appendChild(option);
        });
    });
}

/**
 * Sets up event listeners for the bug selection dropdowns.
 */
function setupBugSelectListeners() {
    document.querySelectorAll('.bug-select').forEach(select => {
        select.addEventListener('change', function() {
            const formType = this.id.split('-')[0];
            const manualContainer = document.getElementById(`${formType}-manual-bug-container`);
            const wildcardContainer = document.getElementById(`${formType}-wildcard-container`);
            if (this.value === 'manual') {
                manualContainer.classList.add('show');
                wildcardContainer.classList.remove('show');
            } else if (this.value !== '') {
                manualContainer.classList.remove('show');
                wildcardContainer.classList.add('show');
            } else {
                manualContainer.classList.remove('show');
                wildcardContainer.classList.remove('show');
            }
        });
    });
}

/**
 * Displays a fallback proxy list if the main one fails to load.
 */
function displayFallbackProxyList() {
    proxyList = [{
        ip: '103.6.207.108',
        port: '8080',
        country: 'ID',
        provider: 'PT Pusat Media Indonesia'
    }];
    filteredProxyList = [...proxyList];
    renderProxyList();
}

/**
 * Detects the delimiter in a line of proxy data.
 * @param {string} line - A sample line from the proxy list.
 * @returns {string} The detected delimiter.
 */
function detectDelimiter(line) {
    if (line.includes('\t')) return '\t';
    if (line.includes('|')) return '|';
    if (line.includes(';')) return ';';
    return ',';
}

// --- FORM & QR CODE HANDLING --- //

/**
 * Handles the submission of any protocol form.
 * @param {Event} event - The form submission event.
 */
function handleFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const formType = form.id.split('-')[0];

    const connectionUrl = generateConnectionUrl(formType, formData);
    if (connectionUrl) {
        dom.connectionUrl.textContent = connectionUrl;
        generateQRCode(connectionUrl);
        showResultSection();
    }
}

/**
 * Generates the final connection URL based on form data.
 * @param {string} formType - The protocol type (vmess, vless, etc.).
 * @param {FormData} formData - The form data.
 * @returns {string|null} The generated URL or null on error.
 */
function generateConnectionUrl(formType, formData) {
    let customBug = formData.get('bug')?.toString().trim() || '';
    if (customBug === 'manual') {
        customBug = document.getElementById(`${formType}-manual-bug`).value.trim();
    }

    const useWildcard = formData.get('wildcard') === 'on';
    const selectedDomain = formData.get('server-domain') || selectedServerDomain;
    const security = formData.get('security');
    const port = security === 'tls' ? 443 : 80;
    const path = formData.get('path');
    const name = encodeURIComponent(formData.get('name'));

    let server = customBug || selectedDomain;
    let host = useWildcard && customBug ? `${customBug}.${selectedDomain}` : (customBug || selectedDomain);
    let sni = useWildcard && customBug ? `${customBug}.${selectedDomain}` : (customBug || selectedDomain);

    switch (formType) {
        case 'vmess':
            const vmessConfig = {
                v: '2', ps: formData.get('name'), add: server, port, id: formData.get('uuid'), aid: '0',
                net: 'ws', type: 'none', host, path, tls: security, sni, scy: 'zero'
            };
            return 'vmess://' + btoa(JSON.stringify(vmessConfig));
        case 'vless':
            return `vless://${formData.get('uuid')}@${server}:${port}?encryption=none&security=${security}&type=ws&host=${host}&path=${encodeURIComponent(path)}&sni=${sni}#${name}`;
        case 'trojan':
            return `trojan://${formData.get('password')}@${server}:${port}?security=${security}&type=ws&host=${host}&path=${encodeURIComponent(path)}&sni=${sni}#${name}`;
        case 'ss':
            const userInfo = btoa(`none:${formData.get('password')}`);
            return `ss://${userInfo}@${server}:${port}?encryption=none&type=ws&host=${host}&path=${encodeURIComponent(path)}&security=${security}&sni=${sni}#${name}`;
        default:
            return null;
    }
}

/**
 * Handles the click event for the copy URL button.
 * @this {HTMLButtonElement}
 */
function handleCopyUrl() {
    const button = this;
    navigator.clipboard.writeText(dom.connectionUrl.textContent).then(() => {
        button.innerHTML = '<i class="fas fa-check mr-1"></i> Copied!';
        setTimeout(() => {
            button.innerHTML = '<i class="far fa-copy mr-1"></i> Copy';
        }, 2000);
    });
}

/**
 * Generates and displays a QR code for the given text.
 * @param {string} text - The text to encode in the QR code.
 */
function generateQRCode(text) {
    dom.qrcode.innerHTML = '';
    QRCode.toCanvas(dom.qrcode, text, { width: 200, margin: 1 }, (error) => {
        if (error) console.error('QR Code generation failed:', error);
    });
}

/**
 * Downloads the generated QR code as a PNG file.
 */
function downloadQRCode() {
    const canvas = dom.qrcode.querySelector('canvas');
    if (canvas) {
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = 'qrcode.png';
        link.click();
    } else {
        alert('Could not download QR code.');
    }
}

/**
 * Selects a proxy and populates the account creation form.
 * @param {number} index - The index of the selected proxy.
 */
async function selectProxy(index) {
    selectedProxy = filteredProxyList[index];
    const { ip, port, country, provider } = selectedProxy;

    // Update UI
    document.getElementById('selected-ip').textContent = ip;
    document.getElementById('selected-port').textContent = port;
    document.getElementById('selected-country').textContent = country;
    document.getElementById('selected-provider').textContent = provider;

    // Update form fields
    const baseAccountName = `${country} - ${provider}`;
    const path = CONFIG.PATH_TEMPLATE.replace('{ip}', ip).replace('{port}', port);

    ['vmess', 'vless', 'trojan', 'ss'].forEach(type => {
        document.getElementById(`${type}-path`).value = path;
        const security = document.getElementById(`${type}-security`).value;
        const tlsType = security === 'tls' ? 'TLS' : 'NTLS';
        document.getElementById(`${type}-name`).value = `${baseAccountName} [${type.toUpperCase()}-${tlsType}]`;
    });

    // Re-attach listeners for security dropdowns
    setupSecuritySelectListeners(baseAccountName);

    // Check status
    checkProxyStatusInForm(selectedProxy);
}

/**
 * Sets up event listeners for the security dropdowns to update account names.
 * @param {string} baseAccountName - The base name for the account.
 */
function setupSecuritySelectListeners(baseAccountName) {
    ['vmess', 'vless', 'trojan', 'ss'].forEach(type => {
        const select = document.getElementById(`${type}-security`);
        const nameInput = document.getElementById(`${type}-name`);
        
        // Clone and replace to remove old listeners
        const newSelect = select.cloneNode(true);
        select.parentNode.replaceChild(newSelect, select);

        newSelect.addEventListener('change', function() {
            const tlsType = this.value === 'tls' ? 'TLS' : 'NTLS';
            nameInput.value = `${baseAccountName} [${type.toUpperCase()}-${tlsType}]`;
        });
    });
}

/**
 * Checks the status of the selected proxy and updates the UI in the form.
 * @param {object} proxy - The proxy to check.
 */
async function checkProxyStatusInForm(proxy) {
    const statusContainer = document.getElementById('proxy-status-container');
    const elements = {
        loading: document.getElementById('proxy-status-loading'),
        active: document.getElementById('proxy-status-active'),
        dead: document.getElementById('proxy-status-dead'),
        unknown: document.getElementById('proxy-status-unknown'),
        latency: document.getElementById('proxy-latency')
    };

    const setStatus = (status) => {
        Object.values(elements).forEach(el => el.classList.add('hidden'));
        statusContainer.classList.remove('hidden');
        if (elements[status]) elements[status].classList.remove('hidden');
    };

    setStatus('loading');
    const startTime = performance.now();

    try {
        const response = await fetch(`${CONFIG.STATUS_CHECK_URL}${proxy.ip}:${proxy.port}`);
        const data = await response.json();
        const endTime = performance.now();
        const latency = Math.floor(endTime - startTime);
        const proxyData = Array.isArray(data) ? data[0] : data;

        if (proxyData && proxyData.proxyip === true) {
            setStatus('active');
            elements.latency.textContent = `${latency}ms`;
        } else {
            setStatus('dead');
        }
    } catch (error) {
        setStatus('unknown');
        console.error('Fetch error:', error);
    }
}
