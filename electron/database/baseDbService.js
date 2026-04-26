/**
 * BaseDbService — clase base para todos los domain services.
 * Encapsula el patrón if (!this.db) + try/catch + logging.
 * Cada dominio hace: class RecordingsDbService extends BaseDbService { ... }
 */
class BaseDbService {
  constructor(db, domain) {
    this.db = db;
    this.domain = domain; // ej: 'recordings', 'speakers' — para los logs
  }

  /** Log tag consistente: [DB][domain] */
  _log(...args) {
    console.error(`[DB][${this.domain}]`, ...args);
  }

  /**
   * Ejecuta una query que devuelve múltiples filas (SELECT).
   * @param {string} query - SQL preparado
   * @param {any[]} params - Parámetros para el statement
   */
  _getMany(query, params = []) {
    if (!this.db) return [];
    try {
      return this.db.prepare(query).all(...params);
    } catch (error) {
      this._log(`Error en _getMany: ${error.message}`);
      return [];
    }
  }

  /**
   * Ejecuta un SELECT que devuelve una sola fila.
   * @param {string} query - SQL preparado
   * @param {any[]} params - Parámetros para el statement
   */
  _getOne(query, params = [], defaultValue = null) {
    if (!this.db) return defaultValue;
    try {
      const result = this.db.prepare(query).get(...params);
      return result ?? defaultValue;
    } catch (error) {
      this._log(`Error en _getOne: ${error.message}`);
      return defaultValue;
    }
  }

  /**
   * Ejecuta un statement que modifica datos (INSERT/UPDATE/DELETE).
   * @param {string} query - SQL preparado
   * @param {any[]} params - Parámetros para el statement
   * @returns {{ success: true, info: object }} | {{ success: false, error: string }}
   */
  _run(query, params = []) {
    if (!this.db) return { success: false, error: 'DB no inicializada' };
    try {
      const info = this.db.prepare(query).run(...params);
      return { success: true, info };
    } catch (error) {
      this._log(`Error en run: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Versión de _run que también devuelve lastInsertRowid como { success, id }
   * para queries INSERT.
   */
  _insert(query, params = []) {
    if (!this.db) return { success: false, error: 'DB no inicializada' };
    try {
      const info = this.db.prepare(query).run(...params);
      return { success: true, id: info.lastInsertRowid, changes: info.changes };
    } catch (error) {
      this._log(`Error en insert: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Ejecuta un UPDATE/DELETE que devuelve cambios.
   */
  _modify(query, params = []) {
    if (!this.db) return { success: false, error: 'DB no inicializada' };
    try {
      const info = this.db.prepare(query).run(...params);
      return { success: true, changes: info.changes };
    } catch (error) {
      this._log(`Error en modify: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

module.exports = BaseDbService;