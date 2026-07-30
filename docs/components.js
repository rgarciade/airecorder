
class AppHeader extends HTMLElement {
  connectedCallback() {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    // Pages listed here have two canonical URLs (one per language) instead of a single
    // URL with client-side auto-detected language, so search engines can index each
    // language separately. The toggle below navigates between the pair for these pages;
    // on every other page (changelog, wiki redirects) it keeps the old in-place swap.
    const bilingualPages = ['index.html', 'vs-plaud.html'];
    const pathname = window.location.pathname;
    const enHomeMatch = /\/en\/?$/.test(pathname); // directory-style /en/ (home)
    const enFileMatch = pathname.match(/\/en\/([^/]+\.html)$/); // /en/<file>.html
    const isEnPage = enHomeMatch || (!!enFileMatch && bilingualPages.includes(enFileMatch[1]));
    const isEsBilingualPage = !isEnPage && bilingualPages.includes(currentPath);
    const currentLang = (function() { try { return localStorage.getItem('airecorder-lang'); } catch(e) { return null; } })() || (isEnPage ? 'en' : 'es');

    let esTarget = null, enTarget = null;
    if (isEnPage) {
      const file = enHomeMatch ? 'index.html' : enFileMatch[1];
      esTarget = file === 'index.html' ? '/airecorder/' : '/airecorder/' + file;
    } else if (isEsBilingualPage) {
      enTarget = currentPath === 'index.html' ? '/airecorder/en/' : '/airecorder/en/' + currentPath;
    }
    const esOnclick = esTarget ? `window.location.href='${esTarget}'+window.location.hash` : "window.setLang('es')";
    const enOnclick = enTarget ? `window.location.href='${enTarget}'+window.location.hash` : "window.setLang('en')";

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
            <li><a href="/airecorder/vp/guide/local-ai" ${currentPath.startsWith('vp/guide/local-ai') ? 'class="active"' : ''} data-i18n="navDocs">Guía IA Local</a></li>
            <li><a href="/airecorder/vp/" ${currentPath.startsWith('vp/') ? 'class="active"' : ''} data-i18n="navWiki">Wiki</a></li>
            <li><a href="/airecorder/changelog.html" ${currentPath === 'changelog.html' ? 'class="active"' : ''} data-i18n="navChangelog">Novedades</a></li>
            <li>
              <div class="lang-toggle" role="group" aria-label="Idioma">
                <button class="lang-btn ${currentLang === 'es' ? 'active' : ''}" data-lang="es" onclick="${esOnclick}">ES</button>
                <button class="lang-btn ${currentLang === 'en' ? 'active' : ''}" data-lang="en" onclick="${enOnclick}">EN</button>
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
        <a href="/airecorder/vp/guide/local-ai" data-i18n="navDocs">Guía IA Local</a>
        <a href="/airecorder/vp/" data-i18n="navWiki">Wiki</a>
        <a href="changelog.html" data-i18n="navChangelog">Novedades</a>
        <a href="index.html#descarga" class="nav-cta" data-i18n="navDownload">Descargar</a>
        <div class="lang-toggle">
          <button class="lang-btn ${currentLang === 'es' ? 'active' : ''}" data-lang="es" onclick="${esOnclick}">ES</button>
          <button class="lang-btn ${currentLang === 'en' ? 'active' : ''}" data-lang="en" onclick="${enOnclick}">EN</button>
        </div>
      </div>
    `;

    this.initListeners();
    // After appending HTML, re-run translations only if the page hasn't already
    // initialised a language (window.currentLang). This prevents overriding a
    // language the user just selected before this custom element was connected.
    if (window.setLang && !window.currentLang) window.setLang(currentLang);
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
        
        if (hash && (href.startsWith('#') || window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/'))) {
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
            <a href="https://ko-fi.com/airecorderraulgarciadelafuente" target="_blank" rel="noopener" style="display:inline-block;margin:16px 0 8px;">
              <img height="36" style="border:0;height:36px;" src="https://storage.ko-fi.com/cdn/kofi2.png?v=3" alt="Support AIRecorder on Ko-fi" />
            </a>
            <nav class="footer-links" aria-label="Links del footer">
              <a href="https://github.com/rgarciade/airecorder" target="_blank" rel="noopener" data-i18n="footerGH">GitHub</a>
              <span>·</span>
              <a href="https://github.com/rgarciade/airecorder/releases" target="_blank" rel="noopener" data-i18n="footerReleases">Releases</a>
              <span>·</span>
        <a href="/airecorder/changelog.html" data-i18n="navChangelog">Novedades</a>
              <span>·</span>
              <a href="https://github.com/rgarciade/airecorder/issues" target="_blank" rel="noopener" data-i18n="footerIssues">Reportar un problema</a>
              <span>·</span>
              <a href="mailto:garcia.de.la.fuente.raul@gmail.com" data-i18n="footerContact">Contacto</a>
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
