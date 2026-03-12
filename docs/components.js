
class AppHeader extends HTMLElement {
  connectedCallback() {
    const currentLang = (function() { try { return localStorage.getItem('airecorder-lang'); } catch(e) { return null; } })() || (navigator.language.startsWith('en') ? 'en' : 'es');
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    
    this.innerHTML = `
      <nav class="nav" id="nav">
        <div class="nav-inner">
          <a href="index.html" class="nav-logo">
            <div class="nav-logo-icon" role="img" aria-label="AIRecorder"></div>
            AIRecorder
          </a>
          <ul class="nav-links" role="list">
            <li><a href="index.html#funciones" data-i18n="navFeatures">Funciones</a></li>
            <li><a href="index.html#privacidad" data-i18n="navPrivacy">Privacidad</a></li>
            <li><a href="index.html#proveedores" data-i18n="navProviders">Proveedores IA</a></li>
            <li><a href="docs.html" ${currentPath === 'docs.html' ? 'class="active"' : ''} data-i18n="navDocs">Guía IA Local</a></li>
            <li><a href="changelog.html" ${currentPath === 'changelog.html' ? 'class="active"' : ''} data-i18n="navChangelog">Novedades</a></li>
            <li>
              <div class="lang-toggle" role="group" aria-label="Idioma">
                <button class="lang-btn ${currentLang === 'es' ? 'active' : ''}" data-lang="es" onclick="window.setLang('es')">ES</button>
                <button class="lang-btn ${currentLang === 'en' ? 'active' : ''}" data-lang="en" onclick="window.setLang('en')">EN</button>
              </div>
            </li>
            <li><a href="index.html#descarga" class="nav-cta" data-i18n="navDownload">Descargar</a></li>
          </ul>
          <button class="nav-hamburger" id="hamburger" aria-label="Menú" aria-expanded="false">
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </nav>

      <div class="nav-mobile" id="nav-mobile" role="navigation">
        <a href="index.html#funciones" data-i18n="navFeatures">Funciones</a>
        <a href="index.html#privacidad" data-i18n="navPrivacy">Privacidad</a>
        <a href="index.html#proveedores" data-i18n="navProviders">Proveedores IA</a>
        <a href="docs.html" data-i18n="navDocs">Guía IA Local</a>
        <a href="changelog.html" data-i18n="navChangelog">Novedades</a>
        <a href="index.html#descarga" class="nav-cta" data-i18n="navDownload">Descargar</a>
        <div class="lang-toggle">
          <button class="lang-btn ${currentLang === 'es' ? 'active' : ''}" data-lang="es" onclick="window.setLang('es')">ES</button>
          <button class="lang-btn ${currentLang === 'en' ? 'active' : ''}" data-lang="en" onclick="window.setLang('en')">EN</button>
        </div>
      </div>
    `;

    this.initListeners();
    // After appending HTML, we must re-run translations if window.TRANSLATIONS exist
    if (window.setLang) window.setLang(currentLang);
  }

  initListeners() {
    const nav = this.querySelector('#nav');
    if (nav) {
      const onScroll = () => { nav.classList.toggle('scrolled', window.scrollY > 20); };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    const hamburger = this.querySelector('#hamburger');
    const navMobile = this.querySelector('#nav-mobile');
    
    if (hamburger && navMobile) {
      hamburger.addEventListener('click', () => {
        const isOpen = hamburger.classList.toggle('open');
        navMobile.classList.toggle('open', isOpen);
        hamburger.setAttribute('aria-expanded', isOpen);
      });

      navMobile.querySelectorAll('a').forEach(l => l.addEventListener('click', () => {
        hamburger.classList.remove('open');
        navMobile.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      }));

      document.addEventListener('click', e => {
        if (!this.contains(e.target)) {
          hamburger.classList.remove('open');
          navMobile.classList.remove('open');
          hamburger.setAttribute('aria-expanded', 'false');
        }
      });
    }

    this.querySelectorAll('a[href^="#"], a[href^="index.html#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        const href = anchor.getAttribute('href');
        const hash = href.includes('#') ? '#' + href.split('#')[1] : null;
        
        if (hash && (href.startsWith('#') || window.location.pathname.endsWith('index.html') || window.location.pathname === '/')) {
          const target = document.querySelector(hash);
          if (target) {
            e.preventDefault();
            const offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 64;
            const top = target.getBoundingClientRect().top + window.scrollY - offset;
            window.scrollTo({ top, behavior: 'smooth' });
          }
        }
      });
    });
  }
}

class AppFooter extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <footer class="footer">
        <div class="container">
          <div class="footer-inner">
            <div class="footer-logo">
              <div class="footer-logo-icon" role="img" aria-label="AIRecorder"></div>
              AIRecorder
            </div>
            <p class="footer-tagline" data-i18n="footerTagline">Toma el control de tus reuniones y proyectos. Todo en local, todo privado.</p>
            <nav class="footer-links" aria-label="Links del footer">
              <a href="https://github.com/rgarciade/airecorder" target="_blank" rel="noopener" data-i18n="footerGH">GitHub</a>
              <span>·</span>
              <a href="https://github.com/rgarciade/airecorder/releases" target="_blank" rel="noopener" data-i18n="footerReleases">Releases</a>
              <span>·</span>
              <a href="changelog.html" data-i18n="navChangelog">Novedades</a>
              <span>·</span>
              <a href="https://github.com/rgarciade/airecorder/issues" target="_blank" rel="noopener" data-i18n="footerIssues">Reportar un problema</a>
            </nav>
            <div class="footer-divider"></div>
            <p class="footer-copyright" data-i18n-html="footerCopyright">
              © 2024–2026 AIRecorder · Desarrollado por <a href="https://github.com/rgarciade" target="_blank" rel="noopener">Raul Garcia</a> · <a href="https://github.com/rgarciade/airecorder/blob/main/LICENSE" target="_blank" rel="noopener">MIT + Commons Clause</a>
            </p>
          </div>
        </div>
      </footer>
    `;
  }
}

customElements.define('app-header', AppHeader);
customElements.define('app-footer', AppFooter);
