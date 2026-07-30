    // === Animaciones al scroll con IntersectionObserver ===
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.08,
      rootMargin: '0px 0px -40px 0px'
    });

    document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));

    // === Activar elementos del hero inmediatamente ===
    document.querySelectorAll('.hero .animate-on-scroll').forEach((el, i) => {
      setTimeout(() => el.classList.add('visible'), i * 80);
    });

    // === Waveform: alturas y delays dinámicos ===
    document.querySelectorAll('.waveform-bar').forEach(bar => {
      const h = (Math.random() * 70 + 30).toFixed(0) + '%';
      const d = (Math.random() * 2).toFixed(2) + 's';
      bar.style.setProperty('animation-delay', d);
    });

    // === Toggle funciones expandibles ===
    function toggleFeatures() {
      const btn = document.getElementById('featuresToggle');
      const grid = document.getElementById('featuresMoreGrid');
      const isOpen = btn.classList.toggle('open');
      grid.classList.toggle('open', isOpen);
      btn.setAttribute('aria-expanded', isOpen);
      if (!isOpen) {
        setTimeout(() => {
          grid.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
      }
    }

    // === FAQ Accordion ===
    function toggleFaq(questionEl) {
      const item = questionEl.closest('.faq-item');
      const isOpen = item.classList.toggle('open');
      questionEl.setAttribute('aria-expanded', isOpen);
    }

    // === Flujo en vivo: tabs con barra de progreso (estilo Orca) ===
    (function setupFlowTabs() {
      const wrap = document.getElementById('flowWrap');
      if (!wrap) return;
      const tabs = Array.from(wrap.querySelectorAll('.flow-tab'));
      const panels = Array.from(wrap.querySelectorAll('.flow-panel'));
      const DURATION = 7000;
      let active = 0;
      let timer = null;
      let visible = false;

      function setActive(index) {
        active = index;
        tabs.forEach((tab, i) => {
          const isActive = i === active;
          tab.classList.toggle('active', isActive);
          const fill = tab.querySelector('.flow-tab-fill');
          fill.classList.remove('filling', 'full');
          fill.style.width = '';
          void fill.offsetWidth;
          if (i < active) {
            fill.classList.add('full');
          } else if (isActive) {
            fill.style.animationDuration = DURATION + 'ms';
            fill.classList.add('filling');
          } else {
            fill.style.width = '0%';
          }
        });
        panels.forEach((panel, i) => panel.classList.toggle('active', i === active));
        restartTimer();
      }

      function restartTimer() {
        clearTimeout(timer);
        if (!visible) return;
        timer = setTimeout(() => setActive((active + 1) % tabs.length), DURATION);
      }

      tabs.forEach((tab, i) => tab.addEventListener('click', () => setActive(i)));

      tabs[0].classList.add('active');
      panels[0].classList.add('active');

      const observer = new IntersectionObserver(entries => {
        entries.forEach(e => {
          visible = e.isIntersecting;
          if (visible) setActive(active);
          else clearTimeout(timer);
        });
      }, { threshold: 0.3 });
      observer.observe(wrap);
    })();

    // === Floating CTA: ocultar cuando el footer es visible ===
    (function setupFloatingCta() {
      const floatBtn = document.getElementById('floatingCta');
      const footer = document.querySelector('.footer');
      if (!floatBtn || !footer) return;

      const footerObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          floatBtn.style.opacity = entry.isIntersecting ? '0' : '1';
          floatBtn.style.pointerEvents = entry.isIntersecting ? 'none' : 'auto';
        });
      }, { threshold: 0 });

      footerObserver.observe(footer);
    })();

    // === Modal Descarga ===
    function openDownloadModal(e) {
      e.preventDefault();
      document.getElementById('downloadModal').classList.add('active');
    }

    function closeDownloadModal(e) {
      document.getElementById('downloadModal').classList.remove('active');
    }

    // === Detectar SO y destacar el botón de descarga correspondiente ===
    (function detectPlatformDownload() {
      const isWindows = /Win/i.test(navigator.platform) || /Windows/i.test(navigator.userAgent);
      const btnMac = document.getElementById('btn-mac');
      const btnWin = document.getElementById('btn-win');
      const container = btnMac && btnMac.parentElement;
      const heroBtn = document.getElementById('hero-btn');
      const heroBtnText = document.getElementById('hero-btn-text');

      if (isWindows) {
        if (btnWin && btnMac && container) {
          btnWin.classList.add('recommended');
          container.insertBefore(btnWin, btnMac);
        }
        if (heroBtn && heroBtnText) {
          heroBtnText.setAttribute('data-i18n', 'heroBtnWin');
          heroBtn.href = 'https://github.com/rgarciade/airecorder/releases/latest';
          heroBtn.removeAttribute('onclick');
          heroBtn.target = '_blank';
          heroBtn.rel = 'noopener';
        }
      } else {
        if (btnMac) {
          btnMac.classList.add('recommended');
        }
      }
    })();

    // === Traducciones / Translations ===
    const TRANSLATIONS = {
      es: {
        pageTitle: 'AIRecorder | IA local para reuniones, transcripción y conocimiento de proyectos',
        navFeatures: 'Funciones', navPrivacy: 'Privacidad', navProviders: 'Proveedores IA',
        navDocs: 'Guía IA Local', navChangelog: 'Novedades', navDownload: 'Descargar',
        heroBadge: 'Disponible para macOS y Windows',
        heroTitle: 'Tus reuniones y proyectos,<br><span>entendidos por IA local</span>',
        heroTagline: 'Graba, transcribe y chatea con el conocimiento de tus reuniones y proyectos.<br>IA local por defecto, 100% privada — proveedores externos solo si tú los activas.',
        heroBtnMac: 'Descargar para macOS', heroBtnWin: 'Descargar para PC', heroBtnGH: 'Ver en GitHub',
        heroNote: 'macOS y Windows · Código abierto en GitHub',
        flowLabel: 'En vivo', flowTitle: 'De la reunión a la tarea, en minutos',
        flowSubtitle: 'Así se mueve tu reunión dentro de AIRecorder, sin que hagas nada más que grabar.',
        flowStage1Title: 'Grabando reunión', flowStage1Desc: 'Micrófono y audio del sistema, dos pistas independientes.',
        flowStage2Title: 'Transcribiendo y chateando', flowStage2Desc: 'Whisper local en 90+ idiomas, con chat IA sobre lo que se dijo.',
        flowStage3Title: 'Generando resumen con IA', flowStage3Desc: 'Decisiones, participantes y puntos clave.',
        flowStage4Title: 'Tareas creadas en tu Kanban', flowStage4Desc: 'Backlog, En progreso, Bloqueado, Hecho.',
        flowBadge: 'POTENCIADO POR IA', flowRecordTitle: 'Nueva Sesión',
        flowRecordSubtitle: 'Empieza a grabar al instante. La IA se encargará de la transcripción, resumen y extracción de puntos clave automáticamente.',
        flowPillTeams: 'Teams', flowPillAudio: 'Audio', flowPillImport: 'Importar con IA', flowRecordBtnLabel: 'INICIAR',
        flowPillMic: 'Micrófono del MacBook Pro', flowPillSystem: 'Audio del sistema', flowPillLang: 'Español',
        flowStatWeekLabel: 'Esta semana', flowStatTranscriptsLabel: 'Transcripciones', flowStatTranscriptsValue: '19 archivos', flowStatTotalLabel: 'Total grabado',
        flowSearchPlaceholder: '🔍 Buscar en la transcripción...', flowModelPill: 'Modelo: medium',
        flowT1: '¿Alguna otra cosa? Creo que estamos en medio de la sprint. También hubo un problema con el export de CSV que fue promovido hoy.',
        flowT2: 'Ok, hablando de la corrección de tarifa, creo que tenemos que arreglarlo directo en la app.',
        flowChatHeadTitle: 'AI Assistant', flowChatPrompt: 'Summarize Action Items', flowChatHeading: 'Action Items',
        flowChatBullet1Strong: 'Corrección de tarifa:', flowChatBullet1Text: 'arreglar la lógica en la app, no solo vía CSV',
        flowChatBullet2Strong: 'Arreglo de exportación:', flowChatBullet2Text: 'corregir el export que falla con tarifas ajustadas',
        flowChatInputPlaceholder: 'Haz una pregunta...',
        flowChatGreeting: '¡Hola! Preguntame lo que quieras sobre esta reunión.', flowChatQuestion: '¿qué se decidió del roadmap?', flowChatAnswer: 'Se decidió priorizar el Q3 y posponer la migración.',
        flowChatQuestion2: '¿quién se encarga de la migración?', flowChatAnswer2: 'Marcos la lidera a partir de la próxima sprint.',
        flowSummaryHead: '✨ Quick Summary', flowHighlightsHead: 'Key Highlights', flowParticipantsHead: 'Participants',
        flowDetailedSummaryHead: 'Resumen Detallado', flowSchemeHead: 'Esquema',
        flowTask1: 'Preparar demo para cliente', flowTask2: 'Revisar propuesta de Q3', flowColEmpty: 'Sin tareas',
        screenshotsLabel: 'Vista previa', screenshotsTitle: 'Mira cómo funciona',
        screenshotsSubtitle: 'Una interfaz limpia y enfocada en tu flujo de trabajo. Sin distracciones.',
        screenshotResumen: 'Resumen · Análisis e insights generados con IA',
        screenshotAudioChat: 'Audio Chat · Conversación en tiempo real con IA',
        screenshotHome: 'Inicio · Nueva sesión de grabación',
        screenshotProjects: 'Proyectos · Biblioteca y grabaciones recientes',
        screenshotAiChat: 'Chat con IA · Búsqueda semántica sobre el proyecto',
        screenshotTranscription: 'Transcripción · Texto generado automáticamente con Whisper',
        featLabel: 'Funciones',
        featTitle: 'Todo lo que necesitas para<br>tus reuniones y proyectos',
        featSubtitle: 'Desde la grabación hasta el análisis con IA, AIRecorder cubre todo el flujo de trabajo sin depender de servicios externos.',
        feat1Title: 'Grabación dual de audio', feat1Desc: 'Captura simultáneamente el micrófono y el audio del sistema. Sin perder una sola palabra, tuya ni de los demás.',
        feat2Title: 'Transcripción automática', feat2Desc: 'Whisper de OpenAI funciona directamente en tu equipo. Alta precisión, múltiples modelos y sin enviar audio a ningún servidor.',
        feat3Title: 'Análisis con IA', feat3Desc: 'Genera resúmenes detallados, extrae puntos clave e identifica participantes automáticamente a partir de la transcripción.',
        feat4Title: 'Chat interactivo', feat4Desc: 'Pregunta a la IA directamente sobre el contenido de cualquier reunión. Extrae información, fechas, compromisos o cualquier detalle.',
        feat5Title: 'Exportación de documentos', feat5Desc: 'Exporta transcripciones y resúmenes a DOCX, PDF o Markdown con un clic. Comparte actas de reunión sin esfuerzo.',
        feat6Title: 'Gestión de proyectos', feat6Desc: 'Organiza tus grabaciones en proyectos. Dashboard con estadísticas de horas, reuniones y estado de transcripciones.',
        feat7Title: 'Múltiples modelos de IA', feat7Desc: 'Compatible con Gemini, DeepSeek, Kimi en la nube, y con Ollama y LM Studio para análisis completamente local.',
        feat8Title: 'Funciona sin conexión', feat8Desc: 'Con Ollama o LM Studio, toda la cadena, grabación, transcripción y análisis, funciona sin internet ni suscripciones.',
        feat9Title: 'Importa transcripciones de Teams', feat9Desc: '¿Tu reunión fue grabada en Microsoft Teams? Importa el archivo de transcripción directamente y analízalo con IA como si lo hubieras grabado tú mismo.',
        feat10Title: 'Sube audio de dispositivos externos', feat10Desc: 'Grabaste con una grabadora, móvil o cualquier otro dispositivo. Sube el archivo de audio y AIRecorder lo transcribe y analiza automáticamente.',
        feat11Title: 'Tareas con IA y tablero Kanban', feat11Desc: 'La IA extrae tareas accionables de cada reunión y las organiza en un tablero Kanban con columnas Backlog, En progreso, Bloqueado y Hecho. Arrastra, edita y refina cada tarea con IA.',
        feat12Title: 'Búsqueda semántica con RAG', feat12Desc: 'Las transcripciones se indexan con embeddings vectoriales en LanceDB. El chat usa RAG para encontrar exactamente el fragmento relevante, incluso en proyectos con horas de grabaciones.',
        feat13Title: 'Adjuntos como contexto para la IA', feat13Desc: 'Adjunta imágenes, PDFs, documentos o Excel a cualquier grabación o proyecto. La IA los incorpora como contexto en el chat, con soporte de visión para modelos compatibles.',
        feat14Title: 'Reproductor sincronizado con la transcripción', feat14Desc: 'Haz clic en cualquier frase de la transcripción para saltar al instante exacto del audio. Reproduce micrófono y sistema como pistas independientes con control de velocidad.',
        featChatImportTitle: 'Importa conversaciones de chat con IA', featChatImportDesc: 'Importa archivos de conversaciones o chats analizados por IA y tratalos como cualquier grabación: resumen, tareas, búsqueda semántica y chat interactivo sobre el contenido.',
        featSpeakersTitle: 'Identificación de Hablantes', featSpeakersDesc: 'Diarización automática que detecta quién habla en cada segmento. Gestiona, fusiona y nombra hablantes entre grabaciones. La IA reconoce a cada persona y enriquece el análisis con su voz.',
        featExpertsTitle: 'Prompts de Experto', featExpertsDesc: 'Activa perfiles especializados de Desarrollador de Software o Psicólogo para que la IA adapte su análisis al contexto exacto de tu reunión. Incluye un asistente general para cualquier tipo de conversación.',
        featShowAll: 'Ver todas las funciones', featShowLess: 'Mostrar menos',
        ctaMidTitle: '¿Listo para tomar el control de tus reuniones?',
        ctaMidSubtitle: 'Descarga AIRecorder gratis. Sin registros, sin servidores, sin letra pequeña.',
        ctaMidBtn: 'Descargar ahora',
        faqLabel: 'FAQ', faqTitle: 'Preguntas frecuentes',
        faq1Q: '¿Por qué AIRecorder frente a Otter o Fireflies?',
        faq1A: 'AIRecorder es la única opción 100% local. Otter y Fireflies suben tu audio a sus servidores para procesarlo. Con AIRecorder, tus datos nunca salen de tu equipo. Además, es gratuito y open source. <a href="vs-otter.html" style="color:var(--color-primary); font-weight:600;">Ver comparativa con Otter →</a> · <a href="vs-fireflies.html" style="color:var(--color-primary); font-weight:600;">con Fireflies →</a>',
        faq2Q: '¿Necesito conexión a internet?',
        faq2A: 'No. Con Ollama o LM Studio puedes grabar, transcribir y analizar completamente offline. Si usas proveedores cloud como Gemini, solo necesitas internet para la parte de análisis; la transcripción con Whisper siempre es local.',
        faq3Q: '¿Qué necesito para usarlo?',
        faq3A: 'Un Mac con Apple Silicon (M1/M2/M3/M4) y macOS 13+, o un PC con Windows 10/11 (x64). Para transcripción, Whisper se instala automáticamente. Para análisis con IA, puedes usar Ollama (gratuito, local) o conectarlo a Gemini/DeepSeek con tu propia API key.',
        faq4Q: '¿Es realmente gratis?',
        faq4A: 'Sí. AIRecorder es completamente gratuito y open source (MIT). No hay planes de pago, suscripciones ni funcionalidades premium. Si quieres apoyar el proyecto, puedes invitarme a un café en Ko-fi.',
        faq5Q: '¿Qué idiomas soporta la transcripción?',
        faq5A: 'Whisper soporta más de 90 idiomas con alta precisión, incluyendo español, inglés, francés, alemán, portugués, italiano y muchos más. Puedes elegir el modelo y el idioma para cada grabación.',
        faq6Q: '¿Puedo chatear con mis reuniones y proyectos?',
        faq6A: 'Sí. Cada reunión y cada proyecto tienen su propio chat con IA: puedes preguntar por decisiones, fechas, compromisos o cualquier detalle. El sistema usa RAG (búsqueda semántica con LanceDB) para encontrar el fragmento exacto entre horas de grabaciones.',
        faq7Q: '¿Por qué usar IA local en vez de un proveedor en la nube?',
        faq7A: 'Porque tus reuniones suelen contener información sensible. Con Ollama o LM Studio, el análisis corre en tu equipo y nada sale de él. Los proveedores externos (Gemini, DeepSeek, Kimi) son opcionales: los activas solo si necesitas más potencia y aceptas enviar ese contenido a la nube.',
        faq8Q: '¿Cómo graba AIRecorder el audio de una reunión?',
        faq8A: 'AIRecorder captura al mismo tiempo tu micrófono y el audio del sistema como dos pistas independientes, así no perdés ni tu voz ni la de los demás participantes, sea en una llamada de Meet, Zoom, Teams o presencial con el micrófono del equipo.',
        faq9Q: '¿Qué resúmenes genera AIRecorder de una reunión?',
        faq9A: 'La IA genera un resumen detallado, extrae decisiones, identifica participantes y convierte los compromisos en tareas accionables organizadas en un tablero Kanban (Backlog, En progreso, Bloqueado, Hecho). Todo a partir de la transcripción, sin trabajo manual.',
        faq10Q: '¿AIRecorder identifica quién habla en cada momento?',
        faq10A: 'Sí. Usa diarización de hablantes con pyannote para separar y etiquetar cada intervención por participante, incluso en reuniones con varias personas hablando en el mismo canal de audio.',
        faq11Q: '¿Puedo exportar las actas o resúmenes de mis reuniones?',
        faq11A: 'Sí, con un clic exportás transcripción y resumen a DOCX, PDF o Markdown, listos para compartir como acta de reunión sin retocar nada.',
        faq12Q: '¿AIRecorder es un grabador de reuniones offline y local?',
        faq12A: 'Sí. AIRecorder es un grabador de reuniones 100% local y offline: graba, transcribe con Whisper y analiza con Ollama o LM Studio sin salir de tu equipo. No necesitás internet ni subir audio a ningún servidor, a diferencia de las grabadoras de reuniones basadas en la nube.',
        faq13Q: '¿Hay una alternativa gratis y local a Plaud?',
        faq13A: 'Sí, AIRecorder. Plaud requiere comprar un dispositivo dedicado y su transcripción gratuita tiene un límite mensual de minutos; superarlo exige suscripción paga. AIRecorder es software gratuito y de código abierto, sin límite de minutos: usa el micrófono y el audio de tu equipo, y con Ollama o LM Studio la transcripción y el análisis corren 100% en tu equipo, no en un servidor externo. <a href="vs-plaud.html" style="color:var(--color-primary); font-weight:600;">Ver la comparativa completa →</a>',
        faq14Q: '¿Son seguras las grabaciones si se guardan localmente?',
        faq14A: 'Sí. Tus grabaciones y transcripciones se guardan solo en el sistema de archivos y la base de datos SQLite de tu equipo: nunca se suben a un servidor ni se comparten con terceros. AIRecorder no tiene telemetría ni analytics. Si conectás integraciones opcionales (Google, Teams), esas credenciales se cifran en tu equipo con el almacenamiento seguro del sistema operativo (Keychain en macOS, DPAPI en Windows).',
        faq15Q: '¿AIRecorder es un grabador de reuniones local?',
        faq15A: 'Sí. AIRecorder es un grabador de reuniones local: la grabación de audio, la transcripción con Whisper y el análisis con Ollama o LM Studio corren en tu equipo. No es una app en la nube ni requiere subir audio a ningún servidor.',
        faq16Q: '¿Cómo genera AIRecorder resúmenes de reuniones con IA local?',
        faq16A: 'Al terminar la transcripción, la IA local (Ollama o LM Studio) genera resúmenes de reuniones locales: puntos clave, decisiones, participantes y tareas, todo procesado en tu equipo sin enviar el contenido a servidores externos. Si preferís más potencia, podés activar proveedores en la nube de forma opcional.',
        faq17Q: '¿AIRecorder conecta el conocimiento entre distintas reuniones de un proyecto?',
        faq17A: 'Sí. Todas las transcripciones de un proyecto se indexan en una base vectorial (LanceDB) y el chat con IA usa RAG para buscar entre todas tus reuniones a la vez, no solo una por una. Así podés preguntar algo que se dijo en una reunión de hace semanas y encontrarlo aunque no recuerdes en cuál fue.',
        faq18Q: '¿Puedo tener un chat local sobre mis reuniones guardadas?',
        faq18A: 'Sí. Cada reunión y cada proyecto guardado tiene su propio chat con IA. Con Ollama o LM Studio, ese chat corre 100% local sobre tus reuniones guardadas: nada de tu historial de conversaciones o transcripciones sale de tu equipo.',
        faq19Q: '¿Qué incluye el ecosistema de grabación de reuniones e IA local de AIRecorder?',
        faq19A: 'Grabación dual de audio, transcripción con Whisper, resúmenes y tareas generadas por IA, diarización de hablantes, chat con RAG, exportación a DOCX/PDF/Markdown y gestión de proyectos, todo integrado en un mismo ecosistema que funciona local con Ollama o LM Studio, con proveedores en la nube como opción adicional.',
        faq20Q: '¿Cuál es la mejor alternativa local a Otter, Fireflies o Fathom?',
        faq20A: 'AIRecorder. A diferencia de Otter, Fireflies o Fathom, que procesan tu audio en sus servidores, AIRecorder graba, transcribe y analiza de forma 100% local con Ollama o LM Studio. Es gratuito, de código abierto y sin límite de minutos. Comparativas: <a href="vs-otter.html" style="color:var(--color-primary); font-weight:600;">Otter</a> · <a href="vs-fireflies.html" style="color:var(--color-primary); font-weight:600;">Fireflies</a> · <a href="vs-fathom.html" style="color:var(--color-primary); font-weight:600;">Fathom</a>',
        floatingCta: 'Descargar gratis',
        privLabel: 'Privacidad',
        privTitle: 'Tu privacidad,<br>nuestra prioridad',
        privSubtitle: 'Tus reuniones contienen información sensible. AIRecorder está diseñado para que tus datos nunca salgan de tu equipo.',
        priv1: '<strong>Transcripción 100% local</strong> con Whisper ejecutándose directamente en tu equipo.',
        priv2: '<strong>Sin servidores externos</strong> para tus audios. Las grabaciones viven en tu sistema de archivos.',
        priv3: '<strong>IA completamente local</strong> con Ollama y LM Studio: análisis sin ninguna petición a internet.',
        priv4: '<strong>Base de datos local</strong> en SQLite. Sin telemetría, sin analytics, sin tracking.',
        priv5: '<strong>Tú controlas todo.</strong> Las claves de API de proveedores cloud son opcionales y las gestionas tú.',
        provLabel: 'Proveedores IA',
        provTitle: 'Compatible con los mejores<br>modelos de IA',
        provSubtitle: 'Elige entre proveedores en la nube para mayor potencia, o modelos locales para privacidad total. Cambia cuando quieras.',
        provOllamaType: '✓ Verificado', provTestingType: 'En testeo',
        provNote: 'Ollama, LM Studio y las conexiones compatibles con la API de OpenAI son 100% verificadas. Los demás proveedores están en fase de testeo. La transcripción siempre corre localmente con Whisper.',
        provCustomName: 'Compatible con API OpenAI',
        navDocs: 'Guía IA Local',
        dlTitle: 'Descarga AIRecorder',
        dlSubtitle: 'Empieza a grabar y analizar tus reuniones hoy mismo. Gratis, local y sin complicaciones.',
        dlMacMain: 'Descargar para macOS', dlMacSub: 'Apple Silicon · macOS 13+', dlMacTag: 'Disponible ahora',
        dlWinMain: 'Descargar para Windows', dlWinSub: 'Windows 10/11 · x64', dlWinTag: 'Disponible ahora',
        dlLinuxMain: 'Descargar para Linux', dlLinuxSub: '.deb · AppImage · x64', dlLinuxTag: 'En pruebas',
        footerTagline: 'Toma el control de tus reuniones y proyectos. Todo en local, todo privado.',
        footerGH: 'GitHub', footerReleases: 'Releases', footerIssues: 'Reportar un problema', footerContact: 'Contacto',
        footerCopyright: '© 2024–2026 AIRecorder · Desarrollado por <a href="https://github.com/rgarciade" target="_blank" rel="noopener">Raul Garcia</a> · <a href="https://github.com/rgarciade/airecorder/blob/main/LICENSE" target="_blank" rel="noopener">MIT + Commons Clause</a>',
        modalTitle: 'Instrucciones de Instalación',
        modalText: '<p>⚠️ <strong>La app está en desarrollo preliminar y aún no está firmada.</strong></p><p>Para abrir la app por primera vez, es posible que tengas que lanzar este comando en la terminal después de instalarla (arrastrarla) en Aplicaciones:</p><code class="modal-code">xattr -cr /Applications/AIRecorder.app</code><div style="margin-top:1.5rem;padding-top:1rem;border-top:1px solid rgba(255,255,255,0.1)"><p style="margin-bottom:.5rem;font-size:.95em"><strong>🔄 ¿Estás actualizando desde una versión anterior?</strong></p><ol style="font-size:.9em;opacity:.9"><li>Borra la app actual de la carpeta Aplicaciones antes de instalar la nueva.</li><li>Cuando te pida permisos de captura de pantalla o accesibilidad, tienes que <strong>ELIMINAR</strong> el permiso antiguo en Ajustes del Sistema de macOS y volver a añadírselo a la nueva app.</li></ol></div>',
        modalCancel: 'Cancelar', modalConfirm: 'Entendido y Descargar',
      },
      en: {
        pageTitle: 'AIRecorder | Local AI for meetings, transcription, and project knowledge',
        navFeatures: 'Features', navPrivacy: 'Privacy', navProviders: 'AI Providers',
        navDocs: 'Local AI Guide', navChangelog: "What's New", navDownload: 'Download',
        heroBadge: 'Available for macOS and Windows',
        heroTitle: 'Your meetings and projects,<br><span>understood by local AI</span>',
        heroTagline: 'Record, transcribe, and chat with the knowledge in your meetings and projects.<br>Local AI by default, 100% private — external providers only if you enable them.',
        heroBtnMac: 'Download for macOS', heroBtnWin: 'Download for PC', heroBtnGH: 'View on GitHub',
        heroNote: 'macOS & Windows · Open source on GitHub',
        flowLabel: 'Live', flowTitle: 'From meeting to task, in minutes',
        flowSubtitle: 'This is how your meeting moves through AIRecorder — all you do is hit record.',
        flowStage1Title: 'Recording meeting', flowStage1Desc: 'Microphone and system audio, two independent tracks.',
        flowStage2Title: 'Transcribing and chatting', flowStage2Desc: 'Local Whisper in 90+ languages, with AI chat over what was said.',
        flowStage3Title: 'Generating AI summary', flowStage3Desc: 'Decisions, highlights, and participants.',
        flowStage4Title: 'Tasks created on your Kanban', flowStage4Desc: 'Backlog, In Progress, Blocked, Done.',
        flowBadge: 'AI-POWERED', flowRecordTitle: 'New Session',
        flowRecordSubtitle: 'Start recording instantly. The AI takes care of transcription, summary, and extracting key points automatically.',
        flowPillTeams: 'Teams', flowPillAudio: 'Audio', flowPillImport: 'Import with AI', flowRecordBtnLabel: 'START',
        flowPillMic: 'MacBook Pro Microphone', flowPillSystem: 'System audio', flowPillLang: 'English',
        flowStatWeekLabel: 'This week', flowStatTranscriptsLabel: 'Transcripts', flowStatTranscriptsValue: '19 files', flowStatTotalLabel: 'Total recorded',
        flowSearchPlaceholder: '🔍 Search transcript...', flowModelPill: 'Model: medium',
        flowT1: 'Anything else? I think we\'re mid-sprint right now. There was also an issue with the CSV export that was pushed today.',
        flowT2: "Ok, speaking of the rate correction, I think we need to fix that directly in the app.",
        flowChatHeadTitle: 'AI Assistant', flowChatPrompt: 'Summarize Action Items', flowChatHeading: 'Action Items',
        flowChatBullet1Strong: 'Rate correction:', flowChatBullet1Text: 'fix the logic in the app, not just via CSV',
        flowChatBullet2Strong: 'Export fix:', flowChatBullet2Text: 'fix the export that fails with adjusted rates',
        flowChatInputPlaceholder: 'Ask a question...',
        flowChatGreeting: "Hi! Ask me anything about this meeting.", flowChatQuestion: 'what did we decide on the roadmap?', flowChatAnswer: 'The team decided to prioritize Q3 and postpone the migration.',
        flowChatQuestion2: "who's handling the migration?", flowChatAnswer2: 'Marcos is leading it starting next sprint.',
        flowSummaryHead: '✨ Quick Summary', flowHighlightsHead: 'Key Highlights', flowParticipantsHead: 'Participants',
        flowDetailedSummaryHead: 'Detailed Summary', flowSchemeHead: 'Outline',
        flowTask1: 'Prepare client demo', flowTask2: 'Review Q3 proposal', flowColEmpty: 'No tasks',
        screenshotsLabel: 'Preview', screenshotsTitle: 'See it in action',
        screenshotsSubtitle: 'A clean interface focused on your workflow. No distractions.',
        screenshotResumen: 'Summary · AI-generated analysis and insights',
        screenshotAudioChat: 'Audio Chat · Real-time AI conversation',
        screenshotHome: 'Home · New recording session',
        screenshotProjects: 'Projects · Library and recent recordings',
        screenshotAiChat: 'AI Chat · Semantic search over the project',
        screenshotTranscription: 'Transcription · Text automatically generated with Whisper',
        featLabel: 'Features',
        featTitle: 'Everything you need for<br>your meetings and projects',
        featSubtitle: 'From recording to AI analysis, AIRecorder covers the entire workflow without depending on external services.',
        feat1Title: 'Dual audio recording', feat1Desc: "Simultaneously capture your microphone and system audio. Never miss a word — yours or anyone else's.",
        feat2Title: 'Automatic transcription', feat2Desc: "OpenAI's Whisper runs directly on your machine. High accuracy, multiple models, no audio sent to any server.",
        feat3Title: 'AI analysis', feat3Desc: 'Generate detailed summaries, extract key points, and automatically identify participants from the transcript.',
        feat4Title: 'Interactive chat', feat4Desc: "Ask the AI directly about any meeting's content. Extract information, dates, commitments, or any detail.",
        feat5Title: 'Document export', feat5Desc: 'Export transcripts and summaries to DOCX, PDF or Markdown with one click. Share meeting minutes effortlessly.',
        feat6Title: 'Project management', feat6Desc: 'Organize your recordings into projects. Dashboard with statistics on hours, meetings, and transcription status.',
        feat7Title: 'Multiple AI models', feat7Desc: 'Compatible with Gemini, DeepSeek, Kimi in the cloud, and Ollama and LM Studio for fully local analysis.',
        feat8Title: 'Works offline', feat8Desc: 'With Ollama or LM Studio, the entire chain — recording, transcription, and analysis — works without internet or subscriptions.',
        feat9Title: 'Import Teams transcripts', feat9Desc: 'Was your meeting recorded in Microsoft Teams? Import the transcript file directly and analyze it with AI as if you had recorded it yourself.',
        feat10Title: 'Upload audio from external devices', feat10Desc: 'Recorded with a recorder, phone, or any other device? Upload the audio file and AIRecorder will transcribe and analyze it automatically.',
        feat11Title: 'AI Tasks & Kanban Board', feat11Desc: 'AI extracts actionable tasks from each meeting and organizes them into a Kanban board with Backlog, In Progress, Blocked and Done columns. Drag, edit and refine each task with AI.',
        feat12Title: 'Semantic search with RAG', feat12Desc: 'Transcripts are indexed with vector embeddings in LanceDB. The chat uses RAG to find exactly the relevant fragment, even in projects with hours of recordings.',
        feat13Title: 'Attachments as AI context', feat13Desc: 'Attach images, PDFs, documents or Excel files to any recording or project. The AI incorporates them as context in the chat, with vision support for compatible models.',
        feat14Title: 'Player synced with transcript', feat14Desc: 'Click any phrase in the transcript to jump to the exact moment in the audio. Play microphone and system as independent tracks with speed control.',
        featChatImportTitle: 'Import AI-analyzed chat conversations', featChatImportDesc: 'Import conversation or AI-analyzed chat files and treat them like any recording: summary, tasks, semantic search, and interactive chat over the content.',
        featSpeakersTitle: 'Speaker Identification', featSpeakersDesc: 'Automatic diarization that detects who speaks in each segment. Manage, merge, and name speakers across recordings. The AI recognizes each person and enriches the analysis with their voice.',
        featExpertsTitle: 'Expert Prompts', featExpertsDesc: 'Activate specialized profiles — Software Developer or Psychologist — so the AI adapts its analysis to the exact context of your meeting. Includes a general assistant for any type of conversation.',
        featShowAll: 'See all features', featShowLess: 'Show less',
        ctaMidTitle: 'Ready to take control of your meetings?',
        ctaMidSubtitle: 'Download AIRecorder for free. No sign-ups, no servers, no fine print.',
        ctaMidBtn: 'Download now',
        faqLabel: 'FAQ', faqTitle: 'Frequently Asked Questions',
        faq1Q: 'Why AIRecorder vs Otter or Fireflies?',
        faq1A: "AIRecorder is the only 100% local option. Otter and Fireflies upload your audio to their servers for processing. With AIRecorder, your data never leaves your machine. Plus, it's free and open source. <a href=\"vs-otter.html\" style=\"color:var(--color-primary); font-weight:600;\">See the Otter comparison →</a> · <a href=\"vs-fireflies.html\" style=\"color:var(--color-primary); font-weight:600;\">Fireflies →</a>",
        faq2Q: 'Do I need an internet connection?',
        faq2A: 'No. With Ollama or LM Studio you can record, transcribe, and analyze completely offline. If you use cloud providers like Gemini, you only need internet for the analysis part; transcription with Whisper is always local.',
        faq3Q: 'What do I need to run it?',
        faq3A: 'A Mac with Apple Silicon (M1/M2/M3/M4) and macOS 13+, or a Windows 10/11 PC (x64). For transcription, Whisper installs automatically. For AI analysis, you can use Ollama (free, local) or connect to Gemini/DeepSeek with your own API key.',
        faq4Q: 'Is it really free?',
        faq4A: 'Yes. AIRecorder is completely free and open source (MIT). There are no paid plans, subscriptions, or premium features. If you want to support the project, you can buy me a coffee on Ko-fi.',
        faq5Q: 'What languages does transcription support?',
        faq5A: 'Whisper supports over 90 languages with high accuracy, including Spanish, English, French, German, Portuguese, Italian, and many more. You can choose the model and language for each recording.',
        faq6Q: 'Can I chat with my meetings and projects?',
        faq6A: "Yes. Every meeting and every project has its own AI chat: ask about decisions, dates, commitments, or any detail. The system uses RAG (semantic search with LanceDB) to find the exact fragment across hours of recordings.",
        faq7Q: 'Why use local AI instead of a cloud provider?',
        faq7A: 'Because your meetings often contain sensitive information. With Ollama or LM Studio, analysis runs on your machine and nothing leaves it. External providers (Gemini, DeepSeek, Kimi) are optional — enable them only if you need more power and accept sending that content to the cloud.',
        faq8Q: 'How does AIRecorder record a meeting?',
        faq8A: "AIRecorder captures your microphone and system audio at the same time as two independent tracks, so you never lose your voice or anyone else's — whether it's a Meet, Zoom, or Teams call, or an in-person meeting through your device's mic.",
        faq9Q: 'What kind of meeting summaries does AIRecorder generate?',
        faq9A: 'The AI generates a detailed summary, extracts decisions, identifies participants, and turns commitments into actionable tasks organized on a Kanban board (Backlog, In Progress, Blocked, Done). All from the transcript, no manual work.',
        faq10Q: "Does AIRecorder identify who's speaking?",
        faq10A: "Yes. It uses speaker diarization with pyannote to separate and label each participant's turns, even in meetings with several people speaking on the same audio channel.",
        faq11Q: 'Can I export my meeting minutes or summaries?',
        faq11A: 'Yes, export the transcript and summary to DOCX, PDF, or Markdown with one click — ready to share as meeting minutes with no extra editing.',
        faq12Q: 'Is AIRecorder an offline, local meeting recorder?',
        faq12A: 'Yes. AIRecorder is a 100% local, offline meeting recorder: it records, transcribes with Whisper, and analyzes with Ollama or LM Studio without ever leaving your machine. No internet required, no audio uploaded to any server — unlike cloud-based meeting recorders.',
        faq13Q: 'Is there a free, local alternative to Plaud?',
        faq13A: "Yes — AIRecorder. Plaud requires buying a dedicated hardware device, and its free transcription tier has a monthly minute cap; going beyond it requires a paid subscription. AIRecorder is free, open-source software with no minute limits: it uses your computer's microphone and system audio, and with Ollama or LM Studio, both transcription and analysis run fully on your machine, not on an external server. <a href=\"vs-plaud.html\" style=\"color:var(--color-primary); font-weight:600;\">See the full comparison →</a>",
        faq14Q: 'Are local recordings secure?',
        faq14A: "Yes. Your recordings and transcripts are stored only in your machine's file system and local SQLite database — never uploaded to a server or shared with third parties. AIRecorder has no telemetry or analytics. If you connect optional integrations (Google, Teams), those credentials are encrypted on your device using the OS's secure storage (Keychain on macOS, DPAPI on Windows).",
        faq15Q: 'Is AIRecorder a local meeting recorder?',
        faq15A: "Yes. AIRecorder is a local meeting recorder: audio recording, transcription with Whisper, and analysis with Ollama or LM Studio all run on your machine. It's not a cloud app and it never requires uploading audio to any server.",
        faq16Q: 'How does AIRecorder generate meeting summaries with local AI?',
        faq16A: 'Once transcription finishes, local AI (Ollama or LM Studio) generates local meeting summaries: key points, decisions, participants, and tasks — all processed on your machine without sending content to external servers. If you want more power, you can optionally enable cloud providers.',
        faq17Q: 'Does AIRecorder connect knowledge across different meetings in a project?',
        faq17A: "Yes. Every transcript in a project is indexed in a vector database (LanceDB), and the AI chat uses RAG to search across all your meetings at once, not just one at a time. You can ask about something mentioned weeks ago and find it even if you don't remember which meeting it was.",
        faq18Q: 'Can I have a local chat over my saved meetings?',
        faq18A: 'Yes. Every saved meeting and project has its own AI chat. With Ollama or LM Studio, that chat runs 100% locally over your saved meetings — none of your conversation history or transcripts ever leaves your machine.',
        faq19Q: "What does AIRecorder's local meeting recording and AI ecosystem include?",
        faq19A: 'Dual audio recording, Whisper transcription, AI-generated summaries and tasks, speaker diarization, RAG-powered chat, DOCX/PDF/Markdown export, and project management — all integrated into one ecosystem that runs locally with Ollama or LM Studio, with cloud providers as an optional add-on.',
        faq20Q: "What's the best local alternative to Otter, Fireflies, or Fathom?",
        faq20A: 'AIRecorder. Unlike Otter, Fireflies, or Fathom — which process your audio on their servers — AIRecorder records, transcribes, and analyzes 100% locally with Ollama or LM Studio. It\'s free, open source, and has no minute limits. Comparisons: <a href="vs-otter.html" style="color:var(--color-primary); font-weight:600;">Otter</a> · <a href="vs-fireflies.html" style="color:var(--color-primary); font-weight:600;">Fireflies</a> · <a href="vs-fathom.html" style="color:var(--color-primary); font-weight:600;">Fathom</a>',
        floatingCta: 'Download free',
        privLabel: 'Privacy',
        privTitle: 'Your privacy,<br>our priority',
        privSubtitle: 'Your meetings contain sensitive information. AIRecorder is designed so your data never leaves your machine.',
        priv1: '<strong>100% local transcription</strong> with Whisper running directly on your machine.',
        priv2: '<strong>No external servers</strong> for your audio. Recordings live on your file system.',
        priv3: '<strong>Fully local AI</strong> with Ollama and LM Studio: analysis with zero internet requests.',
        priv4: '<strong>Local database</strong> in SQLite. No telemetry, no analytics, no tracking.',
        priv5: '<strong>You control everything.</strong> Cloud provider API keys are optional and managed by you.',
        provLabel: 'AI Providers',
        provTitle: 'Compatible with the best<br>AI models',
        provSubtitle: 'Choose cloud providers for more power, or local models for total privacy. Switch whenever you want.',
        provOllamaType: '✓ Verified', provTestingType: 'Testing',
        provNote: 'Ollama, LM Studio, and OpenAI-compatible connections are 100% verified. The other providers are in testing. Transcription always runs locally with Whisper.',
        provCustomName: 'OpenAI-compatible API',
        navDocs: 'Local AI Guide',
        dlTitle: 'Download AIRecorder',
        dlSubtitle: 'Start recording and analyzing your meetings today. Free, local, and hassle-free.',
        dlMacMain: 'Download for macOS', dlMacSub: 'Apple Silicon · macOS 13+', dlMacTag: 'Available now',
        dlWinMain: 'Download for Windows', dlWinSub: 'Windows 10/11 · x64', dlWinTag: 'Available now',
        dlLinuxMain: 'Download for Linux', dlLinuxSub: '.deb · AppImage · x64', dlLinuxTag: 'Beta',
        footerTagline: 'Take control of your meetings and projects. All local, all private.',
        footerGH: 'GitHub', footerReleases: 'Releases', footerIssues: 'Report an issue', footerContact: 'Contact',
        footerCopyright: '© 2024–2026 AIRecorder · Built by <a href="https://github.com/rgarciade" target="_blank" rel="noopener">Raul Garcia</a> · <a href="https://github.com/rgarciade/airecorder/blob/main/LICENSE" target="_blank" rel="noopener">MIT + Commons Clause</a>',
        modalTitle: 'Installation Instructions',
        modalText: '<p>⚠️ <strong>The app is in early development and is not yet signed.</strong></p><p>To open the app for the first time, you may need to run this command in the terminal after installing (dragging) it to Applications:</p><code class="modal-code">xattr -cr /Applications/AIRecorder.app</code><div style="margin-top:1.5rem;padding-top:1rem;border-top:1px solid rgba(255,255,255,0.1)"><p style="margin-bottom:.5rem;font-size:.95em"><strong>🔄 Updating from a previous version?</strong></p><ol style="font-size:.9em;opacity:.9"><li>Delete the current app from the Applications folder before installing the new one.</li><li>When asked for screen recording or accessibility permissions, you must <strong>REMOVE</strong> the old permission in macOS System Settings and re-add it to the new app.</li></ol></div>',
        modalCancel: 'Cancel', modalConfirm: 'Got it, Download',
      }
    };

    function setLang(lang) {
      document.documentElement.lang = lang;
      document.title = TRANSLATIONS[lang].pageTitle;
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const v = TRANSLATIONS[lang][el.dataset.i18n];
        if (v !== undefined) el.textContent = v;
      });
      document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const v = TRANSLATIONS[lang][el.dataset.i18nHtml];
        if (v !== undefined) el.innerHTML = v;
      });
      document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
      });
      try { localStorage.setItem('airecorder-lang', lang); } catch(e) {}
    }
