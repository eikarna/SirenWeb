/**
 * @fileoverview Main JavaScript for the subscription link generator page.
 */

// --- CONFIGURATION & STATE ---

const CONFIG = {
    PROXY_LIST_URL: 'https://raw.githubusercontent.com/AFRcloud/ProxyList/refs/heads/main/ProxyList.txt',
    API_CHECK_URL: 'https://api.jb8fd7grgd.workers.dev/',
    MAIN_DOMAINS: ['siren.afrcloud.site', 'afrcloud.biz.id'],
    DEFAULT_UUID: 'bbbbbbbb-cccc-4ddd-eeee-ffffffffffff',
    MAX_PROXIES: 50,
    DEFAULT_PROXY_COUNT: 5,
    PATH_TEMPLATE: '/afrcloud/{ip}-{port}'
};

let proxyList = [];
let filteredProxyList = [];
let validatedProxies = [];
let validationInProgress = false;

// --- DOM ELEMENTS ---

const dom = {
    form: document.getElementById('subLinkForm'),
    configTypeSelect: document.getElementById('configType'),
    formatTypeSelect: document.getElementById('formatType'),
    uuidInput: document.getElementById('uuid'),
    generateUuidBtn: document.getElementById('generateUuid'),
    bugTypeSelect: document.getElementById('bugType'),
    mainDomainSelect: document.getElementById('mainDomain'),
    customBugContainer: document.getElementById('customBugContainer'),
    customBugInput: document.getElementById('customBug'),
    tlsSelect: document.getElementById('tls'),
    countrySelect: document.getElementById('country'),
    limitInput: document.getElementById('limit'),
    validateProxiesCheckbox: document.getElementById('validateProxies'),
    loadingElement: document.getElementById('loading'),
    validationStatusElement: document.getElementById('validation-status'),
    validationCountElement: document.getElementById('validation-count'),
    validationBarElement: document.getElementById('validation-bar'),
    validCountElement: document.getElementById('valid-count'),
    invalidCountElement: document.getElementById('invalid-count'),
    errorMessageElement: document.getElementById('error-message'),
    resultElement: document.getElementById('result'),
    outputElement: document.getElementById('output'),
    copyLinkBtn: document.getElementById('copyLink')
};

// --- INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    populateMainDomains();
    setupEventListeners();
    loadProxyList();
});

/**
 * Populates the main domain selection dropdown.
 */
function populateMainDomains() {
    CONFIG.MAIN_DOMAINS.forEach(domain => {
        const option = document.createElement('option');
        option.value = domain;
        option.textContent = domain;
        dom.mainDomainSelect.appendChild(option);
    });
}

/**
 * Sets up all event listeners for the page.
 */
function setupEventListeners() {
    dom.generateUuidBtn.addEventListener('click', () => {
        dom.uuidInput.value = crypto.randomUUID();
    });

    dom.bugTypeSelect.addEventListener('change', () => {
        const isCustomBug = ['non-wildcard', 'wildcard'].includes(dom.bugTypeSelect.value);
        dom.customBugContainer.style.display = isCustomBug ? 'block' : 'none';
    });

    dom.form.addEventListener('submit', handleFormSubmit);

    dom.copyLinkBtn.addEventListener('click', handleCopyLink);
}

// --- DATA FETCHING & PROCESSING ---

/**
 * Fetches the proxy list from the configured URL.
 */
function loadProxyList() {
    showLoading('Fetching proxy list...');
    fetch(CONFIG.PROXY_LIST_URL)
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch proxy list');
            return response.text();
        })
        .then(text => {
            processProxyData(text);
            hideLoading();
        })
        .catch(error => {
            console.error('Error loading proxy list:', error);
            showError('Failed to load proxy list. Please try again later.');
            hideLoading();
        });
}

/**
 * Parses the raw proxy list text and populates the country dropdown.
 * @param {string} text - The raw text from the proxy list file.
 */
function processProxyData(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) {
        showError('No proxies found in the proxy list.');
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
                provider: parts.length >= 4 ? parts[3].trim() : 'Unknown Provider'
            };
        }
        return null;
    }).filter(Boolean);

    populateCountryDropdown();
}

/**
 * Populates the country selection dropdown from the loaded proxy list.
 */
function populateCountryDropdown() {
    const countries = [...new Set(proxyList.map(p => p.country))].sort();
    dom.countrySelect.innerHTML = '<option value="">All Countries</option>';
    countries.forEach(country => {
        const option = document.createElement('option');
        option.value = country;
        option.textContent = country;
        dom.countrySelect.appendChild(option);
    });
}

// --- FORM HANDLING & VALIDATION ---

/**
 * Handles the main form submission.
 * @param {Event} event - The form submission event.
 */
async function handleFormSubmit(event) {
    event.preventDefault();
    clearError();

    const formValues = getFormValues();
    if (!formValues) return; // Validation failed

    const { shouldValidate, ...configOptions } = formValues;

    filteredProxyList = getFilteredProxies(configOptions.country);
    if (filteredProxyList.length === 0) {
        showError('No proxies found with the selected criteria.');
        return;
    }

    shuffleArray(filteredProxyList);
    filteredProxyList = filteredProxyList.slice(0, configOptions.limit);

    showLoading('Generating configuration...');

    if (shouldValidate) {
        await validateProxyList();
        // Use only validated proxies if any were found
        if (validatedProxies.length > 0) {
            filteredProxyList = validatedProxies;
        }
    }
    
    const generatedConfig = generateConfiguration(filteredProxyList, configOptions);
    showResult(generatedConfig);
}

/**
 * Gathers and validates values from the form.
 * @returns {object|null} An object with form values or null if validation fails.
 */
function getFormValues() {
    const uuid = dom.uuidInput.value;
    const limit = parseInt(dom.limitInput.value, 10);

    if (!uuid) {
        showError('Please enter a UUID.');
        return null;
    }
    if (isNaN(limit) || limit < 1 || limit > CONFIG.MAX_PROXIES) {
        showError(`Proxy count must be between 1 and ${CONFIG.MAX_PROXIES}.`);
        return null;
    }

    return {
        protocol: dom.configTypeSelect.value,
        format: dom.formatTypeSelect.value,
        uuid,
        bugType: dom.bugTypeSelect.value,
        mainDomain: dom.mainDomainSelect.value,
        customBug: dom.customBugInput.value,
        isTls: dom.tlsSelect.value === 'true',
        country: dom.countrySelect.value,
        limit,
        shouldValidate: dom.validateProxiesCheckbox.checked
    };
}

/**
 * Filters the main proxy list by country.
 * @param {string} country - The country to filter by.
 * @returns {Array<object>} The filtered list of proxies.
 */
function getFilteredProxies(country) {
    return country ? proxyList.filter(p => p.country === country) : [...proxyList];
}


/**
 * Validates the filtered list of proxies.
 */
async function validateProxyList() {
    validationInProgress = true;
    validatedProxies = [];
    let totalValidated = 0;
    let validCount = 0;
    let invalidCount = 0;

    resetValidationUI();
    dom.validationStatusElement.style.display = 'block';

    const updateValidationProgress = () => {
        totalValidated++;
        const progress = (totalValidated / filteredProxyList.length) * 100;
        dom.validationCountElement.textContent = `${totalValidated}/${filteredProxyList.length}`;
        dom.validationBarElement.style.width = `${progress}%`;
        dom.validCountElement.textContent = validCount;
        dom.invalidCountElement.textContent = invalidCount;
    };

    const validationPromises = filteredProxyList.map(async (proxy) => {
        const isValid = await validateProxy(proxy);
        if (isValid) {
            validCount++;
            validatedProxies.push(proxy);
        } else {
            invalidCount++;
        }
        updateValidationProgress();
    });

    await Promise.all(validationPromises);
    validationInProgress = false;
}

/**
 * Checks if a single proxy is active.
 * @param {object} proxy - The proxy object to validate.
 * @returns {Promise<boolean>} True if the proxy is valid, false otherwise.
 */
async function validateProxy(proxy) {
    try {
        const response = await fetch(`${CONFIG.API_CHECK_URL}${proxy.ip}:${proxy.port}`);
        const data = await response.json();
        const proxyData = Array.isArray(data) ? data[0] : data;
        return proxyData && proxyData.proxyip === true;
    } catch (error) {
        console.error(`Error validating proxy ${proxy.ip}:${proxy.port}:`, error);
        return false;
    }
}

// --- CONFIGURATION GENERATION ---

/**
 * Main function to generate configuration based on user options.
 * @param {Array<object>} proxies - The list of proxies to use.
 * @param {object} options - The user-selected options from the form.
 * @returns {string} The generated configuration string.
 */
function generateConfiguration(proxies, options) {
    const configs = [];
    const bugs = (options.customBug && ['non-wildcard', 'wildcard'].includes(options.bugType))
        ? options.customBug.split(',').map(b => b.trim())
        : [options.mainDomain];

    proxies.forEach(proxy => {
        bugs.forEach(bug => {
            const { server, host, sni } = getServerHostSni(options.bugType, bug, options.mainDomain);
            const baseName = `(${(proxy.country || 'UNK').toUpperCase()}) ${proxy.provider}`;
            const path = CONFIG.PATH_TEMPLATE.replace('{ip}', proxy.ip).replace('{port}', proxy.port);
            const port = options.isTls ? 443 : 80;

            const protocolsToGenerate = options.protocol === 'mix' 
                ? ['vmess', 'vless', 'trojan', 'shadowsocks'] 
                : [options.protocol];

            protocolsToGenerate.forEach(proto => {
                configs.push({
                    protocol: proto,
                    proxy,
                    options: { ...options, server, host, sni, path, port, baseName }
                });
            });
        });
    });

    switch (options.format) {
        case 'v2ray':
            return generateV2rayLinks(configs);
        case 'clash':
            return generateClashConfig(configs);
        case 'nekobox':
            return generateNekoboxConfig(configs);
        default:
            showError('Unsupported format type selected.');
            return '';
    }
}

/**
 * Determines the server, host, and SNI based on the bug type.
 * @param {string} bugType - The type of bug ('default', 'non-wildcard', 'wildcard').
 * @param {string} bug - The bug domain.
 * @param {string} mainDomain - The main domain.
 * @returns {{server: string, host: string, sni: string}}
 */
function getServerHostSni(bugType, bug, mainDomain) {
    switch (bugType) {
        case 'non-wildcard':
            return { server: bug, host: mainDomain, sni: mainDomain };
        case 'wildcard':
            return { server: bug, host: `${bug}.${mainDomain}`, sni: `${bug}.${mainDomain}` };
        default: // 'default'
            return { server: mainDomain, host: mainDomain, sni: mainDomain };
    }
}

/**
 * Generates a newline-separated string of V2Ray links.
 * @param {Array<object>} configs - The array of configuration objects.
 * @returns {string} The V2Ray links.
 */
function generateV2rayLinks(configs) {
    const links = configs.map((config, index) => {
        const { protocol, options } = config;
        const { uuid, isTls, server, port, host, path, sni, baseName } = options;
        const tlsStr = isTls ? 'TLS' : 'NTLS';
        const name = encodeURIComponent(`[${index + 1}] ${baseName} [${protocol.toUpperCase()}-${tlsStr}]`);

        switch (protocol) {
            case 'vmess':
                const vmessConfig = {
                    v: '2', ps: decodeURIComponent(name), add: server, port, id: uuid, aid: '0',
                    net: 'ws', type: 'none', host, path, tls: isTls ? 'tls' : '', sni, scy: 'zero'
                };
                return 'vmess://' + btoa(JSON.stringify(vmessConfig));
            case 'vless':
                return `vless://${uuid}@${server}:${port}?encryption=none&security=${isTls ? 'tls' : 'none'}&type=ws&host=${host}&path=${encodeURIComponent(path)}&sni=${sni}#${name}`;
            case 'trojan':
                return `trojan://${uuid}@${server}:${port}?security=${isTls ? 'tls' : 'none'}&type=ws&host=${host}&path=${encodeURIComponent(path)}&sni=${sni}#${name}`;
            case 'shadowsocks':
                const userInfo = btoa(`none:${uuid}`);
                return `ss://${userInfo}@${server}:${port}?plugin=v2ray-plugin%3Btls%3Bmux%3D0%3Bmode%3Dwebsocket%3Bpath%3D${encodeURIComponent(path)}%3Bhost%3D${host}#${name}`;
            default:
                return '';
        }
    });
    return links.filter(Boolean).join('\n');
}

/**
 * Generates a Clash proxy provider configuration.
 * @param {Array<object>} configs - The array of configuration objects.
 * @returns {string} The Clash config in YAML format.
 */
function generateClashConfig(configs) {
    const header = `# Clash Proxy Provider Configuration
# Generated by AFR-Cloud
# Date: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })}
proxies:
`;
    const proxyYaml = configs.map((config, index) => {
        const { protocol, options } = config;
        const { uuid, isTls, server, port, host, path, sni, baseName } = options;
        const tlsStr = isTls ? 'TLS' : 'NTLS';
        const name = `[${index + 1}] ${baseName} [${protocol.toUpperCase()}-${tlsStr}]`;

        let proxyDetails = `
  - name: "${name}"
    server: ${server}
    port: ${port}
    tls: ${isTls}
    skip-cert-verify: true
    network: ws
    ws-opts:
      path: "${path}"
      headers:
        Host: ${host}
`;
        switch (protocol) {
            case 'vmess':
                return proxyDetails + `    type: vmess
    uuid: ${uuid}
    alterId: 0
    cipher: zero
    servername: ${sni}`; 
            case 'vless':
                return proxyDetails + `    type: vless
    uuid: ${uuid}
    servername: ${sni}`; 
            case 'trojan':
                return proxyDetails + `    type: trojan
    password: ${uuid}
    sni: ${sni}`; 
            case 'shadowsocks':
                return `
  - name: "${name}"
    type: ss
    server: ${server}
    port: ${port}
    cipher: none
    password: ${uuid}
    plugin: v2ray-plugin
    plugin-opts:
      mode: websocket
      tls: ${isTls}
      skip-cert-verify: true
      host: ${host}
      path: "${path}"
      mux: false
`;
            default:
                return '';
        }
    }).filter(Boolean).join('');

    return header + proxyYaml;
}

/**
 * Generates a Nekobox configuration.
 * @param {Array<object>} configs - The array of configuration objects.
 * @returns {string} The Nekobox config in JSON format.
 */
function generateNekoboxConfig(configs) {
    const outbounds = configs.map((config, index) => {
        const { protocol, options } = config;
        const { uuid, isTls, server, port, host, path, sni, baseName } = options;
        const tlsStr = isTls ? 'TLS' : 'NTLS';
        const name = `[${index + 1}] ${baseName} [${protocol.toUpperCase()}-${tlsStr}]`;

        const baseConfig = {
            server,
            server_port: port,
            tag: name,
            tls: { enabled: isTls, insecure: false, server_name: sni, utls: { enabled: true, fingerprint: 'randomized' } },
            transport: { type: 'ws', path, headers: { Host: host } }
        };

        switch (protocol) {
            case 'vmess':
                return { ...baseConfig, type: 'vmess', uuid, security: 'zero', alter_id: 0 };
            case 'vless':
                return { ...baseConfig, type: 'vless', uuid, flow: '' };
            case 'trojan':
                return { ...baseConfig, type: 'trojan', password: uuid };
            case 'shadowsocks':
                 return {
                    type: 'shadowsocks',
                    tag: name,
                    server,
                    server_port: port,
                    method: 'none',
                    password: uuid,
                    plugin: 'v2ray-plugin',
                    plugin_opts: `mux=0;path=${path};host=${host};tls=${isTls ? '1' : '0'}`
                };
            default:
                return null;
        }
    }).filter(Boolean);

    const nekoboxJson = {
        dns: { servers: [{ address: "https://family.cloudflare-dns.com/dns-query" }] },
        inbounds: [{ listen: '0.0.0.0', listen_port: 2080, tag: 'mixed-in', type: 'mixed' }],
        outbounds: [
            {
                tag: 'Internet',
                type: 'selector',
                outbounds: [...outbounds.map(o => o.tag), 'direct']
            },
            {
                tag: 'Best Latency',
                type: 'urltest',
                outbounds: [...outbounds.map(o => o.tag), 'direct'],
                url: 'https://detectportal.firefox.com/success.txt',
                interval: '1m0s'
            },
            ...outbounds,
            { tag: 'direct', type: 'direct' },
            { tag: 'bypass', type: 'direct' },
            { tag: 'block', type: 'block' },
            { tag: 'dns-out', type: 'dns' }
        ],
        route: {
            rules: [
                { outbound: 'dns-out', port: [53] },
                { inbound: ['dns-in'], outbound: 'dns-out' },
                { network: ['udp'], port: [443], outbound: 'block' },
                { ip_cidr: ['224.0.0.0/3', 'ff00::/8'], source_ip_cidr: ['224.0.0.0/3', 'ff00::/8'], outbound: 'block' }
            ]
        }
    };

    return JSON.stringify(nekoboxJson, null, 2);
}


// --- UI HELPER FUNCTIONS ---

function showLoading(message) {
    dom.loadingElement.style.display = 'block';
    dom.loadingElement.querySelector('.loading-text').textContent = message;
    dom.resultElement.style.display = 'none';
    dom.validationStatusElement.style.display = 'none';
}

function hideLoading() {
    dom.loadingElement.style.display = 'none';
}

function showError(message) {
    dom.errorMessageElement.textContent = message;
    dom.errorMessageElement.style.display = 'block';
}

function clearError() {
    dom.errorMessageElement.textContent = '';
    dom.errorMessageElement.style.display = 'none';
}

function showResult(config) {
    hideLoading();
    dom.validationStatusElement.style.display = 'none';
    dom.outputElement.value = config;
    dom.resultElement.style.display = 'block';
    dom.resultElement.scrollIntoView({ behavior: 'smooth' });
}

function resetValidationUI() {
    dom.validationCountElement.textContent = `0/${filteredProxyList.length}`;
    dom.validationBarElement.style.width = '0%';
    dom.validCountElement.textContent = '0';
    dom.invalidCountElement.textContent = '0';
}

/**
 * Handles the click event for the copy link button.
 * @this {HTMLButtonElement}
 */
function handleCopyLink() {
    copyToClipboard(dom.outputElement.value).then(success => {
        if (success) {
            this.innerHTML = '<i class="fas fa-check-circle"></i> Copied!';
            setTimeout(() => {
                this.innerHTML = '<i class="far fa-copy"></i> COPY CONFIGURATION';
            }, 2000);
        }
    });
}

// --- UTILITY FUNCTIONS ---

/**
 * Shuffles an array in place.
 * @param {Array} array - The array to shuffle.
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
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