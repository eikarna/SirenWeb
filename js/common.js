/**
 * Sets up common functionality for the website when the DOM is fully loaded.
 * This includes initializing the donation modal, setting the current year,
 * and making helper functions globally available.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI components
    initializeDonationModal();
    setCurrentYear();
    lucide.createIcons();
});

/**
 * Initializes the donation modal, handling its opening and closing.
 */
function initializeDonationModal() {
    const donationButton = document.getElementById('donation-button');
    const donationModal = document.getElementById('donation-modal');
    const closeButton = document.getElementById('close-donation');
    const backdrop = document.getElementById('donation-backdrop');

    if (donationButton && donationModal) {
        const openModal = () => donationModal.classList.remove('hidden');
        const closeModal = () => donationModal.classList.add('hidden');

        donationButton.addEventListener('click', openModal);
        if (closeButton) {
            closeButton.addEventListener('click', closeModal);
        }
        if (backdrop) {
            backdrop.addEventListener('click', closeModal);
        }

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !donationModal.classList.contains('hidden')) {
                closeModal();
            }
        });
    }
}

/**
 * Finds all elements with the ID 'current-year' and sets their text content
 * to the current year.
 */
function setCurrentYear() {
    const yearElements = document.querySelectorAll('#current-year');
    const currentYear = new Date().getFullYear();
    yearElements.forEach(element => {
        element.textContent = currentYear;
    });
}

/**
 * Generates a Version 4 UUID.
 * @returns {string} A new UUID.
 */
function generateUUIDv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Safely encodes a string or object into Base64.
 * @param {string|object} data - The data to encode.
 * @returns {string} The Base64 encoded string, or an empty string on error.
 */
function safeBase64Encode(data) {
    try {
        const stringToEncode = typeof data === 'object' ? JSON.stringify(data) : String(data);
        return window.btoa(stringToEncode);
    } catch (error) {
        console.error('Base64 encoding error:', error);
        return '';
    }
}

/**
 * Formats a date object into a readable string.
 * @param {Date} date - The date to format.
 * @returns {string} The formatted date string.
 */
function formatDate(date) {
    const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString('en-US', options);
}

/**
 * Copies text to the clipboard, with a fallback for older browsers.
 * @param {string} text - The text to copy.
 * @returns {Promise<boolean>} A promise that resolves to true if successful, false otherwise.
 */
async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            const success = document.execCommand('copy');
            document.body.removeChild(textArea);
            return success;
        }
    } catch (error) {
        console.error('Failed to copy text: ', error);
        return false;
    }
}

/**
 * Displays a toast notification.
 * @param {string} message - The message to display.
 * @param {string} [type='info'] - The type of toast (info, success, error).
 * @param {number} [duration=3000] - The duration in milliseconds.
 */
function showToast(message, type = 'info', duration = 3000) {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        Object.assign(toastContainer.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: '9999'
        });
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    Object.assign(toast.style, {
        minWidth: '250px',
        margin: '10px 0',
        padding: '15px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        animation: `fadeIn 0.3s, fadeOut 0.3s ${duration / 1000 - 0.3}s forwards`
    });

    let backgroundColor, icon;
    switch (type) {
        case 'success':
            backgroundColor = 'rgba(16, 185, 129, 0.9)';
            icon = '<i class="fas fa-check-circle"></i>';
            break;
        case 'error':
            backgroundColor = 'rgba(239, 68, 68, 0.9)';
            icon = '<i class="fas fa-exclamation-circle"></i>';
            break;
        default:
            backgroundColor = 'rgba(99, 102, 241, 0.9)';
            icon = '<i class="fas fa-info-circle"></i>';
    }
    toast.style.backgroundColor = backgroundColor;

    toast.innerHTML = `
        <div style="display: flex; align-items: center;">
            <span style="margin-right: 10px; font-size: 18px;">${icon}</span>
            <span style="color: white;">${message}</span>
        </div>
        <button style="background: none; border: none; color: white; cursor: pointer; font-size: 16px;">
            <i class="fas fa-times"></i>
        </button>
    `;

    toast.querySelector('button').addEventListener('click', () => {
        toastContainer.removeChild(toast);
    });

    toastContainer.appendChild(toast);

    // Add animation styles if not already present
    if (!document.getElementById('toast-styles')) {
        const styleSheet = document.createElement('style');
        styleSheet.id = 'toast-styles';
        styleSheet.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes fadeOut {
                from { opacity: 1; transform: translateY(0); }
                to { opacity: 0; transform: translateY(-20px); }
            }
        `;
        document.head.appendChild(styleSheet);
    }

    setTimeout(() => {
        if (toastContainer.contains(toast)) {
            toastContainer.removeChild(toast);
        }
    }, duration);
}

/**
 * Generates a UUID and sets it as the value of a specified input field.
 * @param {string} elementId - The ID of the input field.
 */
function generateUUID(elementId) {
    document.getElementById(elementId).value = generateUUIDv4();
}

/**
 * Generates a UUID and sets it as the value of a specified input field,
 * intended for use as a password.
 * @param {string} elementId - The ID of the input field.
 */
function generatePassword(elementId) {
    document.getElementById(elementId).value = generateUUIDv4();
}
