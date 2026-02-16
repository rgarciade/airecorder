# Servicio de Base de Datos de Proyectos

Servicio modular y funcional para gestionar proyectos y sus relaciones con grabaciones usando `data_file_database`.

## 🏗️ Arquitectura

### Principios de Diseño
- ✅ **Código Limpio**: Funciones puras y responsabilidad única
- ✅ **Programación Funcional**: Operaciones inmutables y composición
- ✅ **DRY (Don't Repeat Yourself)**: Sin duplicación de código
- ✅ **Separación de Responsabilidades**: Lógica de DB separada del main process

### Estructura del Módulo

```
projectsDatabase.js
├── Configuración (DB_CONFIG)
├── Inicialización (initializeDatabaseEnvironment, createDatabaseInstances)
├── Transformadores de Datos (DataTransformers)
├── Operaciones CRUD - Proyectos (ProjectOperations)
├── Operaciones CRUD - Relaciones (RecordingRelationOperations)
└── API Pública (ProjectsDatabase)
```

## 📦 API Pública

### Proyectos (`ProjectsDatabase.projects`)

#### `getAll()`
Obtiene todos los proyectos.

```javascript
const projects = await ProjectsDatabase.projects.getAll();
// Returns: Array<Project>
```

#### `create(projectData)`
Crea un nuevo proyecto.

```javascript
const project = await ProjectsDatabase.projects.create({
  name: 'Mi Proyecto',
  description: 'Descripción opcional'
});
// Returns: Project con id, createdAt, updatedAt
```

#### `update(projectId, projectData)`
Actualiza un proyecto existente.

```javascript
const updated = await ProjectsDatabase.projects.update('123', {
  name: 'Nuevo Nombre',
  description: 'Nueva descripción'
});
// Returns: Project actualizado
```

#### `delete(projectId)`
Elimina un proyecto.

```javascript
await ProjectsDatabase.projects.delete('123');
// Returns: true
```

#### `findById(projectId)`
Busca un proyecto por ID.

```javascript
const project = await ProjectsDatabase.projects.findById('123');
// Returns: Project | null
```

### Relaciones (`ProjectsDatabase.relations`)

#### `upsert(projectId, recordingId)`
Crea o actualiza una relación grabación-proyecto.

```javascript
const { wasReassigned, previousProject } = await ProjectsDatabase.relations.upsert(
  'project-123',
  'recording-456'
);
// Returns: { wasReassigned: boolean, previousProject: Project | null }
```

#### `delete(recordingId)`
Elimina una relación por grabación.

```javascript
await ProjectsDatabase.relations.delete('recording-456');
// Returns: true
```

#### `getRecordingIds(projectId)`
Obtiene IDs de grabaciones de un proyecto.

```javascript
const recordingIds = await ProjectsDatabase.relations.getRecordingIds('project-123');
// Returns: Array<string>
```

#### `findByRecording(recordingId)`
Encuentra relación por grabación.

```javascript
const relation = await ProjectsDatabase.relations.findByRecording('recording-456');
// Returns: Relation | null
```

### Operaciones Compuestas

#### `deleteProjectWithRelations(projectId)`
Elimina un proyecto y todas sus relaciones.

```javascript
await ProjectsDatabase.deleteProjectWithRelations('project-123');
// Returns: true
```

#### `getRecordingProject(recordingId)`
Obtiene el proyecto de una grabación.

```javascript
const project = await ProjectsDatabase.getRecordingProject('recording-456');
// Returns: Project | null
```

## 🔧 Transformadores de Datos

Funciones puras para transformación de datos:

- `now()`: Timestamp actual ISO
- `generateId()`: Genera ID único basado en timestamp
- `createProject(data)`: Crea objeto proyecto con timestamps
- `updateProject(existing, new)`: Actualiza proyecto preservando ID
- `createRecordingRelation(projectId, recordingId)`: Crea relación
- `updateRecordingRelation(existing, projectId)`: Actualiza relación

## 📁 Almacenamiento

Los datos se guardan en:
```
/Users/raul.garciad/Desktop/recorder/dataFileDatabase/
├── projects.json
└── recording_projects.json
```

**Nota**: La ubicación es configurable en `DB_CONFIG.basePath`. Los archivos se crean automáticamente si no existen.

## 🔄 Flujo de Inicialización

1. Crea directorios necesarios si no existen
2. Inicializa archivos JSON vacíos
3. Cambia temporalmente al directorio de trabajo
4. Crea instancias de DataFileDatabase
5. Restaura directorio original
6. Exporta API pública

## 💡 Uso en Main Process

```javascript
const ProjectsDatabase = require('./projectsDatabase');

// Obtener proyectos
ipcMain.handle('get-projects', async () => {
  const projects = await ProjectsDatabase.projects.getAll();
  return { success: true, projects };
});

// Crear proyecto
ipcMain.handle('create-project', async (event, data) => {
  const project = await ProjectsDatabase.projects.create(data);
  return { success: true, project };
});

// Agregar grabación a proyecto
ipcMain.handle('add-recording', async (event, projectId, recordingId) => {
  const result = await ProjectsDatabase.relations.upsert(projectId, recordingId);
  return { success: true, ...result };
});
```

## 🎯 Ventajas

1. **Modularidad**: Lógica de DB completamente separada
2. **Mantenibilidad**: Cambios centralizados en un solo archivo
3. **Testeable**: Funciones puras fáciles de testear
4. **Reusable**: API clara y bien documentada
5. **Escalable**: Fácil agregar nuevas operaciones
6. **Seguridad de Tipos**: Estructura clara de datos
7. **Sin Duplicación**: Código DRY y funcional

## 🔒 Manejo de Errores

Todas las operaciones lanzan errores descriptivos que deben ser manejados por el caller:

```javascript
try {
  const project = await ProjectsDatabase.projects.create(data);
} catch (error) {
  console.error('Error creando proyecto:', error.message);
  // Manejar error apropiadamente
}
```

