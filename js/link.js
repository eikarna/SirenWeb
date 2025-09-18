/**
 * @fileoverview Main JavaScript for the link generator page.
 * Handles fetching proxy lists, displaying proxy details, and generating config links.
 */

// --- CONFIGURATION --- //

/**
 * Configuration constants for the application.
 * @const
 */
const CONFIG = {
    DEFAULT_PROXY_URL: 'https://raw.githubusercontent.com/FoolVPN-ID/Nautica/refs/heads/main/proxyList.txt',
    SERVER_DOMAINS: [window.location.hostname],
    DEFAULT_UUID: 'bbbbbbbb-cccc-4ddd-eeee-ffffffffffff',
    ITEMS_PER_PAGE: 10,
    PATH_TEMPLATE: '/{ip}-{port}',
    STATUS_CHECK_URL: 'https://api.jb8fd7grgd.workers.dev/'
};

// --- STATE --- //

let proxyList = [];
let filteredProxyList = [];
let selectedProxy = null;
let currentPage = 1;

// --- DOM ELEMENTS --- //

const dom = {
    proxyListSection: document.getElementById('proxy-list-section'),
    proxyDetailsSection: document.getElementById('proxy-details-section'),
    loadingIndicator: document.getElementById('loading-indicator'),
    proxyListContainer: document.getElementById('proxy-list-container'),
    noProxiesMessage: document.getElementById('no-proxies-message'),
    customUrlInputContainer: document.getElementById('custom-url-input'),
    proxyUrlInput: document.getElementById('proxy-url'),
    paginationContainer: document.getElementById('pagination-container'),
    proxyCountInfo: document.getElementById('proxy-count-info'),
    searchInput: document.getElementById('search-input'),
    configLinksContainer: document.getElementById('config-links-container'),
};

// --- INITIALIZATION --- //

document.addEventListener('DOMContentLoaded', () => {
    displayFallbackProxyList();
    loadProxyList(CONFIG.DEFAULT_PROXY_URL);
    setupEventListeners();
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

    // Navigation buttons for proxy details section
    document.getElementById('back-to-list-from-details').addEventListener('click', showProxyListSection);
    document.getElementById('back-to-list-from-details-bottom').addEventListener('click', showProxyListSection);

    // Search
    dom.searchInput.addEventListener('input', handleSearch);
}

// --- UI & STATE MANAGEMENT --- //

function showProxyListSection() {
    dom.proxyListSection.classList.remove('hidden');
    dom.proxyDetailsSection.classList.add('hidden');
}

function showProxyDetailsSection() {
    dom.proxyListSection.classList.add('hidden');
    dom.proxyDetailsSection.classList.remove('hidden');
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
                <button class="info-proxy-btn primary-btn py-2 px-4 rounded-lg text-xs group-hover:scale-105 transition-transform" data-index="${index}">Info</button>
            </div>
        </div>
    `;
    card.querySelector('.info-proxy-btn').addEventListener('click', function() {
        showProxyDetails(parseInt(this.dataset.index, 10));
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

// --- PROXY DETAILS & CONFIG LINK GENERATION --- //

/**
 * Shows the details of a selected proxy and generates config links.
 * @param {number} index - The index of the selected proxy.
 */
async function showProxyDetails(index) {
    selectedProxy = filteredProxyList[index];
    const { ip, port, country, provider } = selectedProxy;

    // Update selected proxy info in the details section
    document.getElementById('selected-ip').textContent = ip;
    document.getElementById('selected-port').textContent = port;
    document.getElementById('selected-country').textContent = country;
    document.getElementById('selected-provider').textContent = provider;

    // Check proxy status
    checkProxyStatusInForm(selectedProxy);

    // Generate and display config links for all protocols
    dom.configLinksContainer.innerHTML = ''; // Clear previous links

    const protocols = ['vless', 'trojan', 'vmess', 'ss'];
    const serverDomain = CONFIG.SERVER_DOMAINS[0]; // Use default server domain for config generation
    const path = CONFIG.PATH_TEMPLATE.replace('{ip}', ip).replace('{port}', port);
    const name = encodeURIComponent(`${country} - ${provider}`);

    protocols.forEach(protocolType => {
        // For simplicity, using default UUID/password and TLS for generated links
        const configLink = generateConnectionUrl(protocolType, {
            uuid: CONFIG.DEFAULT_UUID,
            password: CONFIG.DEFAULT_UUID, 
            path: path,
            security: 'tls', 
            serverDomain: serverDomain,
            bug: '', 
            wildcard: 'off',
            name: name
        });

        if (configLink) {
            const linkDiv = document.createElement('div');
            linkDiv.className = 'flex flex-col space-y-2';
            linkDiv.innerHTML = `
                <label class="block text-sm font-medium text-gray-300">${protocolType.toUpperCase()} Link</label>
                <div class="flex">
                    <input type="text" value="${configLink}" class="flex-1 px-4 py-2.5 bg-slate-800/60 border border-cyan-500/30 rounded-l-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500" readonly>
                    <button class="copy-config-link-btn px-4 py-2.5 rounded-r-lg bg-slate-800/60 border border-cyan-500/30 text-gray-300 transition-all hover:bg-slate-700/70 hover:text-white" data-link="${configLink}">
                        <i data-lucide="copy" class="w-4 h-4"></i>
                    </button>
                </div>
            `;
            dom.configLinksContainer.appendChild(linkDiv);
        }
    });

    // Add event listeners for copy buttons
    document.querySelectorAll('.copy-config-link-btn').forEach(button => {
        button.addEventListener('click', function() {
            const linkToCopy = this.dataset.link;
            navigator.clipboard.writeText(linkToCopy).then(() => {
                const originalIcon = this.innerHTML;
                this.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i>';
                setTimeout(() => {
                    this.innerHTML = originalIcon;
                    lucide.createIcons(); // Re-render lucide icons
                }, 2000);
            });
        });
    });
    
    lucide.createIcons(); // Render lucide icons for newly added elements

    showProxyDetailsSection();
}

/**
 * Generates the final connection URL based on form data.
 * This function is retained and adapted for generating links in the details view.
 * @param {string} formType - The protocol type (vmess, vless, etc.).
 * @param {object} data - Object containing necessary data (uuid, password, path, security, serverDomain, bug, wildcard, name).
 * @returns {string|null} The generated URL or null on error.
 */
function generateConnectionUrl(formType, data) {
    const { uuid, password, path, security, serverDomain, bug, wildcard, name } = data;

    let customBug = bug?.toString().trim() || '';
    const useWildcard = wildcard === 'on';
    const selectedDomain = serverDomain || CONFIG.SERVER_DOMAINS[0];
    const port = security === 'tls' ? 443 : 80;

    let server = customBug || selectedDomain;
    let host = useWildcard && customBug ? `${customBug}.${selectedDomain}` : (customBug || selectedDomain);
    let sni = useWildcard && customBug ? `${customBug}.${selectedDomain}` : (customBug || selectedDomain);

    switch (formType) {
        case 'vmess':
            const vmessConfig = {
                v: '2', ps: name, add: server, port, id: uuid, aid: '0',
                net: 'ws', type: 'none', host, path, tls: security, sni, scy: 'zero'
            };
            return 'vmess://' + btoa(JSON.stringify(vmessConfig));
        case 'vless':
            return `vless://${uuid}@${server}:${port}?encryption=none&security=${security}&type=ws&host=${host}&path=${encodeURIComponent(path)}&sni=${sni}#${name}`;
        case 'trojan':
            return `trojan://${password}@${server}:${port}?security=${security}&type=ws&host=${host}&path=${encodeURIComponent(path)}&sni=${sni}#${name}`;
        case 'ss':
            const userInfo = btoa(`none:${password}`);
            return `ss://${userInfo}@${server}:${port}?encryption=none&type=ws&host=${host}&path=${encodeURIComponent(path)}&security=${security}&sni=${sni}#${name}`;
        default:
            return null;
    }
}

/**
 * Checks the status of the selected proxy and updates the UI in the form.
 * @param {object} proxy - The proxy to check.
 */
async function checkProxyStatusInForm(proxy) {
    const statusContainer = document.getElementById('proxy-status-container');
    const latencyEl = document.getElementById('proxy-latency');
    const elements = {
        loading: document.getElementById('proxy-status-loading'),
        active: document.getElementById('proxy-status-active'),
        dead: document.getElementById('proxy-status-dead'),
        unknown: document.getElementById('proxy-status-unknown')
    };

    const setStatus = (status) => {
        Object.values(elements).forEach(el => el.classList.add('hidden'));
        statusContainer.classList.remove('hidden');
        if (elements[status]) elements[status].classList.remove('hidden');
    };

    setStatus('loading');
    latencyEl.textContent = ''; // Clear previous latency
    const startTime = performance.now();

    try {
        const response = await fetch(`${CONFIG.STATUS_CHECK_URL}${proxy.ip}:${proxy.port}`);
        const data = await response.json();
        const endTime = performance.now();
        const latency = Math.floor(endTime - startTime);
        const proxyData = Array.isArray(data) ? data[0] : data;

        if (proxyData && proxyData.proxyip === true) {
            setStatus('active');
            latencyEl.textContent = `${latency}ms`;
        } else {
            setStatus('dead');
        }
    } catch (error) {
        setStatus('unknown');
        console.error('Fetch error:', error);
    }
}
