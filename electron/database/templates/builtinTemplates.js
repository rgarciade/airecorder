// Built-in Note Templates for AIRecorder

const builtinTemplates = [
  // 1. Standup - Daily team standup with yesterday/today/blockers
  {
    slug: 'standup',
    name: 'Standup',
    icon: '🏃',
    description: 'Notas de daily standup con Yesterday/Today/Blockers',
    expert_id: 'developer',
    version: 1,
    sections_json: JSON.stringify([
      {
        id: 'yesterday',
        title: 'Ayer',
        type: 'bullets',
        instructions: 'Lo hecho ayer por cada persona. Lista cada persona y lo que完成了.',
        required: true
      },
      {
        id: 'today',
        title: 'Hoy',
        type: 'bullets',
        instructions: 'Plan de hoy por cada persona. Qué tareas o reuniones tiene planned.',
        required: true
      },
      {
        id: 'blockers',
        title: 'Bloqueos',
        type: 'bullets',
        instructions: 'Bloqueos o dependencias que impiden avanzar. Quién bloquea a quién y por qué.',
        required: false
      },
      {
        id: 'parking-lot',
        title: 'Parking Lot',
        type: 'freeform',
        instructions: 'Temas para conversar fuera del standup. Notas breves de temas que requieren más tiempo.',
        required: false
      }
    ])
  },

  // 2. One-on-One - Manager/employee meeting
  {
    slug: 'one-on-one',
    name: '1:1 Meeting',
    icon: '👥',
    description: 'Reunión one-on-one con logros, preocupaciones y acciones',
    expert_id: 'general',
    version: 1,
    sections_json: JSON.stringify([
      {
        id: 'wins',
        title: 'Logros',
        type: 'bullets',
        instructions: 'Logros y momentos positivos mencionados en la conversación.',
        required: false
      },
      {
        id: 'concerns',
        title: 'Preocupaciones',
        type: 'bullets',
        instructions: 'Preocupaciones o frustraciones expresadas por cualquiera de las partes.',
        required: false
      },
      {
        id: 'career-goals',
        title: 'Goals de Carrera',
        type: 'freeform',
        instructions: 'Goals de crecimiento profesional mencionados. Aspiraciones a corto y largo plazo.',
        required: false
      },
      {
        id: 'feedback',
        title: 'Feedback',
        type: 'qa',
        instructions: 'Feedback intercambiado. Formato Q/A si aplica, o resumen de feedback dado y recibido.',
        required: false
      },
      {
        id: 'action-items',
        title: 'Acciones Acordadas',
        type: 'actions',
        instructions: 'Acciones acordadas con responsable y fecha si se mencionó.',
        required: true
      }
    ])
  },

  // 3. Customer Interview - Product discovery/feedback
  {
    slug: 'customer-interview',
    name: 'Entrevista de Cliente',
    icon: '🎤',
    description: 'Pain points, citas, JTBD y próximos pasos',
    expert_id: 'general',
    version: 1,
    sections_json: JSON.stringify([
      {
        id: 'pain-points',
        title: 'Pain Points',
        type: 'bullets',
        instructions: 'Pain points reales mencionados por el cliente. Problemas específicos que enfrenta.',
        required: true
      },
      {
        id: 'quotes',
        title: 'Citas Destacadas',
        type: 'quote_highlights',
        instructions: 'Citas literales destacadas con atribución. Incluye el nombre del speaker.',
        required: true
      },
      {
        id: 'jobs-to-be-done',
        title: 'Jobs to be Done',
        type: 'bullets',
        instructions: 'Tareas que el cliente intenta resolver. Qué trabajo necesita completar.',
        required: false
      },
      {
        id: 'feature-requests',
        title: 'Solicitudes de Features',
        type: 'bullets',
        instructions: 'Solicitudes explícitas de features o mejoras mencionadas.',
        required: false
      },
      {
        id: 'next-steps',
        title: 'Próximos Pasos',
        type: 'actions',
        instructions: 'Próximos pasos acordados. Quién hace qué y cuándo.',
        required: true
      }
    ])
  },

  // 4. Sales Discovery - BANT qualification
  {
    slug: 'sales-discovery',
    name: 'Discovery Comercial',
    icon: '💼',
    description: 'Calificación BANT con objeciones y próximo paso',
    expert_id: 'general',
    version: 1,
    sections_json: JSON.stringify([
      {
        id: 'bant-budget',
        title: 'Presupuesto',
        type: 'freeform',
        instructions: 'Información sobre presupuesto. Rango, proceso de aprobación, cuándo tienen presupuesto disponible.',
        required: true
      },
      {
        id: 'bant-authority',
        title: 'Autoridad',
        type: 'freeform',
        instructions: 'Quién decide. Cadena de aprobación, stakeholders involucrados.',
        required: true
      },
      {
        id: 'bant-need',
        title: 'Necesidades',
        type: 'bullets',
        instructions: 'Necesidades concretas identificadas. Problemas que buscan resolver.',
        required: true
      },
      {
        id: 'bant-timeline',
        title: 'Timeline',
        type: 'freeform',
        instructions: 'Timeline o urgencia. Cuándo necesitan implementado, deadline.',
        required: true
      },
      {
        id: 'objections',
        title: 'Objeciones',
        type: 'bullets',
        instructions: 'Objeciones expresadas durante la llamada. Preocupaciones o dudas.',
        required: false
      },
      {
        id: 'next-step',
        title: 'Próximo Paso',
        type: 'actions',
        instructions: 'Próximo paso comercial. Demo, propuesta, follow-up, contrato.',
        required: true
      }
    ])
  },

  // 5. Daily Journal - Personal reflection
  {
    slug: 'daily-journal',
    name: 'Diario Personal',
    icon: '📓',
    description: 'Reflexión diaria con mood, gratitud y focos',
    expert_id: 'psychologist',
    version: 1,
    sections_json: JSON.stringify([
      {
        id: 'mood',
        title: 'Estado de Ánimo',
        type: 'freeform',
        instructions: 'Estado emocional captado de la conversación o contexto.',
        required: false
      },
      {
        id: 'reflections',
        title: 'Reflexiones',
        type: 'freeform',
        instructions: 'Reflexiones del día. Pensamientos, aprendizajes, observaciones personales.',
        required: true
      },
      {
        id: 'gratitude',
        title: 'Gratitud',
        type: 'bullets',
        instructions: 'Cosas por las que se mostró gratitud o que fueron positivas.',
        required: false
      },
      {
        id: 'tomorrow-focus',
        title: 'Foco para Mañana',
        type: 'bullets',
        instructions: 'Focos mencionados o planeados para mañana.',
        required: false
      }
    ])
  },

  // 6. Lecture Notes - Educational content
  {
    slug: 'lecture-notes',
    name: 'Notas de Clase',
    icon: '📚',
    description: 'Temas, definiciones, ejemplos y preguntas abiertas',
    expert_id: 'general',
    version: 1,
    sections_json: JSON.stringify([
      {
        id: 'topics',
        title: 'Temas Principales',
        type: 'bullets',
        instructions: 'Temas principales tratados en la clase o presentación.',
        required: true
      },
      {
        id: 'definitions',
        title: 'Definiciones',
        type: 'table',
        instructions: 'Definiciones de términos. Columnas: término y definición.',
        required: false
      },
      {
        id: 'examples',
        title: 'Ejemplos',
        type: 'bullets',
        instructions: 'Ejemplos mencionados para ilustrar conceptos.',
        required: false
      },
      {
        id: 'open-questions',
        title: 'Preguntas Abiertas',
        type: 'bullets',
        instructions: 'Preguntas abiertas o sin resolver que quedaron pendients.',
        required: false
      }
    ])
  },

  // 7. Brainstorm - Idea generation session
  {
    slug: 'brainstorm',
    name: 'Brainstorm',
    icon: '💡',
    description: 'Pool de ideas, temas, top picks y riesgos',
    expert_id: 'general',
    version: 1,
    sections_json: JSON.stringify([
      {
        id: 'ideas-pool',
        title: 'Pool de Ideas',
        type: 'bullets',
        instructions: 'Todas las ideas mencionadas durante la sesión. Sé exhaustivo.',
        required: true
      },
      {
        id: 'themes',
        title: 'Temas',
        type: 'bullets',
        instructions: 'Temas que agrupan las ideas. Cómo se relacionan entre sí.',
        required: false
      },
      {
        id: 'top-picks',
        title: 'Top Picks',
        type: 'bullets',
        instructions: 'Top 3 ideas más prometedoras según el contexto y objetivos.',
        required: false
      },
      {
        id: 'risks',
        title: 'Riesgos',
        type: 'bullets',
        instructions: 'Riesgos o contras mencionados para las ideas.',
        required: false
      }
    ])
  }
];

/**
 * Seed built-in templates into the database.
 * Uses UPSERT - updates only if version is greater (idempotent).
 * @param {Database} db - better-sqlite3 database instance
 */
function seedBuiltinTemplates(db) {
  const stmt = db.prepare(`
    INSERT INTO note_templates
      (slug, name, icon, description, expert_id, sections_json, is_builtin, version)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    ON CONFLICT(slug) DO UPDATE SET
      name          = excluded.name,
      icon          = excluded.icon,
      description   = excluded.description,
      expert_id     = excluded.expert_id,
      sections_json = excluded.sections_json,
      version       = excluded.version,
      updated_at    = datetime('now')
    WHERE note_templates.is_builtin = 1
      AND note_templates.version < excluded.version;
  `);

  const insertMany = db.transaction((templates) => {
    for (const t of templates) {
      stmt.run(
        t.slug,
        t.name,
        t.icon,
        t.description,
        t.expert_id,
        t.sections_json,
        t.version
      );
    }
  });

  insertMany(builtinTemplates);
  console.log(`[DB] Seeded ${builtinTemplates.length} built-in note templates`);
}

module.exports = {
  builtinTemplates,
  seedBuiltinTemplates
};