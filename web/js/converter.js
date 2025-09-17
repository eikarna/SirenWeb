/**
 * @fileoverview JavaScript for the V2Ray to Clash converter page.
 */

document.addEventListener("DOMContentLoaded", () => {
    // --- DOM ELEMENTS ---
    const dom = {
        v2rayInput: document.getElementById("v2ray-input"),
        configOutput: document.getElementById("config-output"),
        convertBtn: document.getElementById("convert-v2ray"),
        copyBtn: document.getElementById("copy-config"),
        loadingIndicator: document.getElementById("loading-indicator"),
        errorMessage: document.getElementById("error-message"),
        // Config type
        minimalConfigBtn: document.getElementById("minimal-config"),
        fullConfigBtn: document.getElementById("full-config"),
        // Clash options
        clashOptionsSection: document.getElementById("clash-options"),
        fakeIpBtn: document.getElementById("fake-ip"),
        redirHostBtn: document.getElementById("redir-host"),
        bestPingBtn: document.getElementById("best-ping"),
        loadBalanceBtn: document.getElementById("load-balance"),
        fallbackBtn: document.getElementById("fallback"),
        allGroupsBtn: document.getElementById("all-groups"),
        adsBlockBtn: document.getElementById("ads-block"),
        pornBlockBtn: document.getElementById("porn-block"),
        // Download buttons
        saveProxyProviderBtn: document.getElementById("save-proxy-provider"),
        saveFullConfigBtn: document.getElementById("save-full-config"),
        // Custom Server/Bug
        customServerToggleBtn: document.getElementById("custom-server-toggle"),
        customServerInputContainer: document.getElementById("custom-server-input-container"),
        customServerInput: document.getElementById("custom-server-input"),
        nonWildcardBtn: document.getElementById("non-wildcard-btn"),
        wildcardBtn: document.getElementById("wildcard-btn"),
    };

    // --- EVENT LISTENERS ---

    // Main conversion button
    dom.convertBtn.addEventListener("click", handleConversion);

    // Copy and download buttons
    dom.copyBtn.addEventListener("click", () => copyToClipboard(dom.configOutput.value, dom.copyBtn));
    dom.saveProxyProviderBtn.addEventListener("click", () => downloadConfig('proxy_provider'));
    dom.saveFullConfigBtn.addEventListener("click", () => downloadConfig('full_config'));

    // UI Toggles
    setupToggle(dom.minimalConfigBtn, [dom.fullConfigBtn], handleConfigTypeChange);
    setupToggle(dom.fullConfigBtn, [dom.minimalConfigBtn], handleConfigTypeChange);
    setupToggle(dom.fakeIpBtn, [dom.redirHostBtn]);
    setupToggle(dom.redirHostBtn, [dom.fakeIpBtn]);
    setupToggle(dom.bestPingBtn);
    setupToggle(dom.loadBalanceBtn);
    setupToggle(dom.fallbackBtn);
    setupToggle(dom.adsBlockBtn);
    setupToggle(dom.pornBlockBtn);
    setupToggle(dom.customServerToggleBtn, [], () => toggleVisibility(dom.customServerInputContainer));
    setupToggle(dom.nonWildcardBtn, [dom.wildcardBtn]);
    setupToggle(dom.wildcardBtn, [dom.nonWildcardBtn]);

    dom.allGroupsBtn.addEventListener("click", () => {
        const isActive = dom.allGroupsBtn.classList.toggle("active");
        [dom.bestPingBtn, dom.loadBalanceBtn, dom.fallbackBtn].forEach(btn => 
            isActive ? btn.classList.add("active") : btn.classList.remove("active")
        );
    });

    // --- FUNCTIONS ---

    /**
     * Handles the main conversion process.
     */
    function handleConversion() {
        const v2rayLinks = dom.v2rayInput.value.trim();
        if (!v2rayLinks) {
            showError("Please enter V2Ray links to convert.");
            return;
        }

        showLoading();
        // Use a timeout to allow the UI to update before the potentially blocking conversion logic
        setTimeout(() => {
            try {
                const parsedLinks = parseLinks(v2rayLinks);
                const clashConfig = generateClashConfig(parsedLinks);
                dom.configOutput.value = clashConfig;
                hideError();
            } catch (error) {
                showError(error.message || "Failed to convert V2Ray links. Please check your input.");
            } finally {
                hideLoading();
            }
        }, 100);
    }

    /**
     * Parses a string of V2Ray links into an array of proxy objects.
     * @param {string} v2rayLinks - Newline-separated V2Ray links.
     * @returns {Array<object>} An array of parsed proxy objects.
     */
    function parseLinks(v2rayLinks) {
        const links = v2rayLinks.split(/r?dist/lucide.min.js/n/).filter(line => line.trim());
        if (links.length === 0) {
            throw new Error("No valid V2Ray links found.");
        }
        let parsed = links.map(parseV2rayLink);

        // Apply custom server/bug if enabled
        if (dom.customServerToggleBtn.classList.contains("active")) {
            const customServer = dom.customServerInput.value.trim();
            if (customServer) {
                const isWildcard = dom.wildcardBtn.classList.contains("active");
                parsed = parsed.map(link => applyCustomServer(link, customServer, isWildcard));
            }
        }
        return parsed;
    }
    
    /**
     * Applies custom server/bug settings to a parsed link.
     * @param {object} link - The parsed proxy link object.
     * @param {string} customServer - The custom server/bug host.
     * @param {boolean} isWildcard - Whether to use wildcard mode.
     * @returns {object} The modified link object.
     */
    function applyCustomServer(link, customServer, isWildcard) {
        const newLink = { ...link };
        const originalHost = newLink.sni || newLink.server;
        newLink.server = customServer; // The IP/address field is always the bug host

        if (isWildcard) {
            newLink.sni = `${customServer}.${originalHost}`;
            if (newLink.wsHost) {
                newLink.wsHost = `${customServer}.${originalHost}`;
            }
        }
        // If not wildcard, the original SNI and wsHost are kept, only the server address is changed.
        return newLink;
    }

    /**
     * Generates the final Clash configuration YAML string.
     * @param {Array<object>} parsedLinks - An array of parsed proxy objects.
     * @returns {string} The generated Clash YAML configuration.
     */
    function generateClashConfig(parsedLinks) {
        const isFullConfig = dom.fullConfigBtn.classList.contains("active");
        const options = {
            useFakeIp: dom.fakeIpBtn.classList.contains("active"),
            groups: {
                bestPing: dom.bestPingBtn.classList.contains("active"),
                loadBalance: dom.loadBalanceBtn.classList.contains("active"),
                fallback: dom.fallbackBtn.classList.contains("active"),
            },
            rules: {
                adsBlock: dom.adsBlockBtn.classList.contains("active"),
                pornBlock: dom.pornBlockBtn.classList.contains("active"),
            }
        };

        if (!isFullConfig) {
            return jsyaml.dump({ proxies: parsedLinks.map(formatProxyForClash) }, { indent: 2 });
        }

        // Full configuration generation
        const fullConfig = {
            'port': 7890,
            'socks-port': 7891,
            'allow-lan': true,
            'mode': 'rule',
            'log-level': 'info',
            'external-controller': '127.0.0.1:9090',
            'dns': {
                'enable': true,
                'listen': '0.0.0.0:53',
                'enhanced-mode': options.useFakeIp ? 'fake-ip' : 'redir-host',
                'nameserver': ['8.8.8.8', '1.1.1.1', 'https://dns.cloudflare.com/dns-query'],
                'fallback': ['1.0.0.1', '8.8.4.4', 'https://dns.google/dns-query'],
            },
            'proxies': parsedLinks.map(formatProxyForClash),
            'proxy-groups': [],
            'rules': [
                'DOMAIN-SUFFIX,local,DIRECT',
                'IP-CIDR,127.0.0.0/8,DIRECT',
                'IP-CIDR,192.168.0.0/16,DIRECT',
            ],
        };

        // Add rule providers
        if (options.rules.adsBlock || options.rules.pornBlock) {
            fullConfig['rule-providers'] = {};
            if (options.rules.adsBlock) {
                fullConfig['rule-providers']['⛔ ADS'] = {
                    type: 'http', behavior: 'domain',
                    url: "https://raw.githubusercontent.com/malikshi/open_clash/refs/heads/main/rule_provider/rule_basicads.yaml",
                    path: "./rule_provider/rule_basicads.yaml", interval: 86400
                };
                fullConfig.rules.push('RULE-SET,⛔ ADS,REJECT');
            }
            if (options.rules.pornBlock) {
                fullConfig['rule-providers']['🔞 Porn'] = {
                    type: 'http', behavior: 'domain',
                    url: "https://raw.githubusercontent.com/malikshi/open_clash/refs/heads/main/rule_provider/rule_porn.yaml",
                    path: "./rule_provider/rule_porn.yaml", interval: 86400
                };
                fullConfig.rules.push('RULE-SET,🔞 Porn,REJECT');
            }
        }
        
        // Add proxy groups
        const proxyNames = parsedLinks.map((p, i) => `[${i + 1}]-${p.name}`);
        fullConfig['proxy-groups'].push({
            name: 'PROXY',
            type: 'select',
            proxies: ['Best Ping', 'Load Balance', 'Fallback', ...proxyNames]
        });

        if(options.groups.bestPing) {
            fullConfig['proxy-groups'].push({
                name: 'Best Ping', type: 'url-test', proxies: proxyNames,
                url: 'http://www.gstatic.com/generate_204', interval: 300
            });
        }
        if(options.groups.loadBalance) {
            fullConfig['proxy-groups'].push({
                name: 'Load Balance', type: 'load-balance', proxies: proxyNames,
                url: 'http://www.gstatic.com/generate_204', interval: 300
            });
        }
        if(options.groups.fallback) {
            fullConfig['proxy-groups'].push({
                name: 'Fallback', type: 'fallback', proxies: proxyNames,
                url: 'http://www.gstatic.com/generate_204', interval: 300
            });
        }

        fullConfig.rules.push('MATCH,PROXY');

        return jsyaml.dump(fullConfig, { indent: 2 });
    }
    
    /**
     * Formats a parsed V2Ray link object into a Clash proxy object.
     * @param {object} link - The parsed link object.
     * @param {number} index - The index of the link.
     * @returns {object} A Clash-compatible proxy object.
     */
    function formatProxyForClash(link, index) {
        const clashProxy = {
            name: `[${index + 1}]-${link.name}`,
            type: link.type,
            server: link.server,
            port: link.port,
            tls: link.tls,
            'skip-cert-verify': link.skipCertVerify || true,
            udp: true,
        };

        if (link.type === 'vmess') {
            Object.assign(clashProxy, {
                uuid: link.uuid,
                alterId: link.alterId || 0,
                cipher: link.cipher || 'auto',
                servername: link.sni,
                network: 'ws',
                'ws-opts': { path: link.wsPath || '/', headers: { Host: link.wsHost || link.sni } }
            });
        } else if (link.type === 'vless') {
            Object.assign(clashProxy, {
                uuid: link.uuid,
                servername: link.sni,
                network: 'ws',
                'ws-opts': { path: link.wsPath || '/', headers: { Host: link.wsHost || link.sni } }
            });
        } else if (link.type === 'trojan') {
            Object.assign(clashProxy, {
                password: link.password,
                sni: link.sni,
                network: 'ws',
                'ws-opts': { path: link.wsPath || '/', headers: { Host: link.wsHost || link.sni } }
            });
        } else if (link.type === 'ss') {
            Object.assign(clashProxy, {
                cipher: link.cipher,
                password: link.password,
                plugin: 'v2ray-plugin',
                'plugin-opts': {
                    mode: 'websocket',
                    tls: link.tls,
                    'skip-cert-verify': true,
                    host: link.wsHost || link.sni,
                    path: link.wsPath || '/'
                }
            });
        }
        return clashProxy;
    }

    // --- PARSING LOGIC ---

    function parseV2rayLink(link) {
        if (link.startsWith("vmess://")) return parseVmessLink(link);
        if (link.startsWith("vless://")) return parseVlessLink(link);
        if (link.startsWith("trojan://")) return parseTrojanLink(link);
        if (link.startsWith("ss://")) return parseShadowsocksLink(link);
        throw new Error(`Unsupported protocol in link: ${link.substring(0, 30)}...`);
    }

    function parseVmessLink(link) {
        const decoded = JSON.parse(atob(link.substring(8)));
        return {
            type: "vmess", name: decoded.ps || "VMess", server: decoded.add,
            port: parseInt(decoded.port, 10), uuid: decoded.id,
            alterId: parseInt(decoded.aid || "0", 10), cipher: decoded.scy || "auto",
            tls: decoded.tls === "tls", network: decoded.net || "tcp",
            wsPath: decoded.path || "/", wsHost: decoded.host || "",
            sni: decoded.sni || decoded.host || decoded.add,
        };
    }

    function parseVlessLink(link) {
        const url = new URL(link);
        return {
            type: "vless", name: decodeURIComponent(url.hash).substring(1) || "VLESS",
            server: url.hostname, port: parseInt(url.port, 10), uuid: url.username,
            tls: url.searchParams.get("security") === "tls", network: url.searchParams.get("type") || "tcp",
            wsPath: url.searchParams.get("path") || "/", wsHost: url.searchParams.get("host") || "",
            sni: url.searchParams.get("sni") || url.searchParams.get("host") || url.hostname,
        };
    }

    function parseTrojanLink(link) {
        const url = new URL(link);
        return {
            type: "trojan", name: decodeURIComponent(url.hash).substring(1) || "Trojan",
            server: url.hostname, port: parseInt(url.port, 10), password: url.username,
            tls: url.searchParams.get("security") === "tls" || true, network: url.searchParams.get("type") || "tcp",
            wsPath: url.searchParams.get("path") || "/", wsHost: url.searchParams.get("host") || "",
            sni: url.searchParams.get("sni") || url.searchParams.get("host") || url.hostname,
        };
    }

    function parseShadowsocksLink(link) {
        const url = new URL(link);
        const userInfo = atob(url.username);
        const [cipher, password] = userInfo.split(":");
        return {
            type: "ss", name: decodeURIComponent(url.hash).substring(1) || "Shadowsocks",
            server: url.hostname, port: parseInt(url.port, 10),
            cipher, password,
            tls: url.searchParams.get("plugin")?.includes("tls"),
            network: url.searchParams.get("plugin")?.includes("websocket") ? 'ws' : 'tcp',
            wsPath: url.searchParams.get("path") || "/",
            wsHost: url.searchParams.get("host") || "",
            sni: url.searchParams.get("sni") || url.searchParams.get("host") || url.hostname,
        };
    }


    // --- UI HELPER FUNCTIONS ---

    function handleConfigTypeChange() {
        const isFull = dom.fullConfigBtn.classList.contains("active");
        toggleVisibility(dom.clashOptionsSection, isFull);
        toggleVisibility(dom.saveProxyProviderBtn, !isFull);
        toggleVisibility(dom.saveFullConfigBtn, isFull);
    }

    function downloadConfig(type) {
        const content = dom.configOutput.value;
        if (!content) {
            showError("No content to download. Please convert first.");
            return;
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
        const filename = `${type}_${timestamp}.yaml`;
        const blob = new Blob([content], { type: "text/yaml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`File "${filename}" downloaded successfully!`);
    }

    function setupToggle(button, others = [], callback) {
        if (!button) return;
        button.addEventListener("click", () => {
            // Special handling for non-exclusive toggles
            if (button.id === 'best-ping' || button.id === 'load-balance' || button.id === 'fallback' || button.id === 'ads-block' || button.id === 'porn-block' || button.id === 'custom-server-toggle') {
                 button.classList.toggle("active");
            } else { // Exclusive toggles
                button.classList.add("active");
                others.forEach(other => other && other.classList.remove("active"));
            }
            if (callback) callback();
        });
    }

    function toggleVisibility(element, forceShow) {
        if (!element) return;
        const shouldShow = forceShow !== undefined ? forceShow : element.style.display === 'none';
        element.style.display = shouldShow ? 'block' : 'none';
    }

    function showLoading() { dom.loadingIndicator.classList.remove("hidden"); }
    function hideLoading() { dom.loadingIndicator.classList.add("hidden"); }
    function showError(message) {
        dom.errorMessage.textContent = message;
        dom.errorMessage.classList.remove("hidden");
    }
    function hideError() { dom.errorMessage.classList.add("hidden"); }

    function copyToClipboard(text, button) {
        if (!text) {
            showError("Nothing to copy.");
            return;
        }
        navigator.clipboard.writeText(text).then(() => {
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(() => {
                button.innerHTML = originalText;
            }, 2000);
        }).catch(() => showError("Failed to copy text."));
    }
    
    // Initial state
    handleConfigTypeChange();
});
