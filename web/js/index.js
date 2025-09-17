/**
 * Initializes the main page functionalities when the DOM is fully loaded.
 */
document.addEventListener('DOMContentLoaded', () => {
    initializeMobileMenu();
    initializeSmoothScroll();
    createParticleAnimation();
    setProfileNameData();
});

/**
 * Sets up the mobile menu toggle functionality.
 */
function initializeMobileMenu() {
    const menuButton = document.getElementById('mobile-menu-btn');
    const mainNav = document.getElementById('main-nav');

    if (menuButton && mainNav) {
        menuButton.addEventListener('click', () => {
            mainNav.classList.toggle('active');
            // Change icon based on menu state
            menuButton.innerHTML = mainNav.classList.contains('active') 
                ? '<i class="fas fa-times"></i>' 
                : '<i class="fas fa-bars"></i>';
        });
    }
}

/**
 * Sets up smooth scrolling for all anchor links pointing to an ID.
 */
function initializeSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (event) {
            event.preventDefault();
            const href = this.getAttribute('href');

            // Ignore if it's just a hash
            if (href === '#') {
                return;
            }

            const targetElement = document.querySelector(href);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth' });

                // If mobile menu is open, close it
                const mainNav = document.getElementById('main-nav');
                const menuButton = document.getElementById('mobile-menu-btn');
                if (mainNav && mainNav.classList.contains('active')) {
                    mainNav.classList.remove('active');
                    menuButton.innerHTML = '<i class="fas fa-bars"></i>';
                }
            }
        });
    });
}

/**
 * Creates and appends animated particles to the element with the ID 'particles'.
 */
function createParticleAnimation() {
    const particleContainer = document.getElementById('particles');
    if (!particleContainer) {
        return;
    }

    const particleCount = 50;
    const colors = ['#6a11cb', '#2575fc', '#a0a0ff', '#ffffff'];

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');

        // Random properties for each particle
        const left = Math.random() * 100;
        const top = Math.random() * 100 + 100; // Start below the view
        const size = Math.random() * 4 + 1;
        const opacity = Math.random() * 0.6 + 0.1;
        const duration = Math.random() * 20 + 10;
        const delay = Math.random() * 10;
        const color = colors[Math.floor(Math.random() * colors.length)];

        // Apply styles
        Object.assign(particle.style, {
            left: `${left}%`,
            top: `${top}%`,
            width: `${size}px`,
            height: `${size}px`,
            opacity: opacity,
            background: color,
            boxShadow: `0 0 ${size * 2}px ${color}`,
            animationDuration: `${duration}s`,
            animationDelay: `${delay}s`
        });

        particleContainer.appendChild(particle);
    }
}

/**
 * Sets the 'data-text' attribute for the profile name element,
 * used for a visual effect.
 */
function setProfileNameData() {
    const profileName = document.querySelector('.profile-name');
    if (profileName) {
        profileName.setAttribute('data-text', 'user');
    }
}
