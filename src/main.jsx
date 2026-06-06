import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { I18nextProvider } from 'react-i18next'
import { store } from './store/store'
import i18n from './i18n/index.js'
import './index.css'
import App from './App.jsx'
import FloatingWidget from './components/FloatingWidget/FloatingWidget.jsx'

const isFloatingView = new URLSearchParams(window.location.search).get('view') === 'floating';

if (isFloatingView) {
  const s = document.createElement('style');
  s.textContent = 'html,body,#root{background:transparent!important;margin:0!important;padding:0!important;overflow:hidden!important;}';
  document.head.appendChild(s);
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    if (window.electronAPI && window.electronAPI.sentryLogError) {
      window.electronAPI.sentryLogError({
        message: error.message,
        name: error.name,
        stack: error.stack,
        componentStack: errorInfo.componentStack
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding: '20px', color: 'white', textAlign: 'center'}}>
          <h2>Ha ocurrido un error inesperado en la interfaz.</h2>
          <p>Por favor, reinicia la aplicación.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isFloatingView ? (
      <FloatingWidget />
    ) : (
      <I18nextProvider i18n={i18n}>
        <Provider store={store}>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </Provider>
      </I18nextProvider>
    )}
  </StrictMode>,
)
