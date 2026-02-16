const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const ffmpegPath = require('ffmpeg-static');
const dbService = require('./dbService');

const execPromise = util.promisify(exec);

class MigrationService {
  /**
   * Obtiene la duración de un archivo de audio usando ffprobe/ffmpeg
   */
  async getAudioDuration(filePath) {
    try {
      // Usamos ffmpeg -i para obtener metadata. La salida va a stderr.
      // Greppeamos "Duration: HH:MM:SS.ms"
      const command = `"${ffmpegPath}" -i "${filePath}" 2>&1 | grep "Duration"`;
      const { stdout } = await execPromise(command);
      
      const match = stdout.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
      if (match) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const seconds = parseInt(match[3], 10);
        const centiseconds = parseInt(match[4], 10);
        
        return (hours * 3600) + (minutes * 60) + seconds + (centiseconds / 100);
      }
      return 0;
    } catch (error) {
      // ffmpeg devuelve código de error si no hay output file, pero stderr tiene la info
      // Si el error contiene la duración, la parseamos de ahí
      if (error.stdout) {
         const match = error.stdout.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
         if (match) {
            const hours = parseInt(match[1], 10);
            const minutes = parseInt(match[2], 10);
            const seconds = parseInt(match[3], 10);
            const centiseconds = parseInt(match[4], 10);
            return (hours * 3600) + (minutes * 60) + seconds + (centiseconds / 100);
         }
      }
      console.warn(`[Migration] No se pudo obtener duración para ${path.basename(filePath)}`);
      return 0;
    }
  }

  /**
   * Determina el estado de la grabación basado en archivos existentes
   */
  determineStatus(folderPath) {
    const analysisPath = path.join(folderPath, 'analysis');
    
    if (fs.existsSync(path.join(analysisPath, 'ai_summary.json')) || 
        fs.existsSync(path.join(analysisPath, 'gemini_summary.json'))) {
      return 'analyzed';
    }
    
    if (fs.existsSync(path.join(analysisPath, 'transcripcion_combinada.json'))) {
      return 'transcribed';
    }
    
    return 'recorded';
  }

  /**
   * Ejecuta la migración/sincronización
   * @param {string} recordingsPath - Ruta base de grabaciones
   */
  async syncRecordings(recordingsPath) {
    console.log('[Migration] Iniciando sincronización...');
    if (!fs.existsSync(recordingsPath)) {
      console.log('[Migration] No existe carpeta de grabaciones.');
      return;
    }

    const folders = await fs.promises.readdir(recordingsPath);
    
    for (const folderName of folders) {
      const folderPath = path.join(recordingsPath, folderName);
      let stats;
      try {
        stats = await fs.promises.stat(folderPath);
      } catch (err) {
        continue;
      }
      
      if (!stats.isDirectory()) continue;

      // Verificar si ya está en DB y si tiene duración > 0
      const existing = dbService.getRecording(folderName);
      if (existing && existing.duration > 0 && existing.status === 'analyzed') {
        // Ya está completo, saltar
        continue;
      }

      // Buscar archivo de audio principal (wav, mp3, webm)
      let files = [];
      try {
        files = await fs.promises.readdir(folderPath);
      } catch (err) {
        continue;
      }
      
      const audioFile = files.find(f => /\.(wav|mp3|webm)$/i.test(f));
      
      let duration = existing ? existing.duration : 0;
      
      // Si no tenemos duración, calcularla
      if (duration === 0 && audioFile) {
        duration = await this.getAudioDuration(path.join(folderPath, audioFile));
      }

      const status = this.determineStatus(folderPath);
      const createdAt = stats.birthtime.toISOString();

      // Guardar en DB
      dbService.saveRecording(folderName, duration, status, createdAt);
      // console.log(`[Migration] Sincronizado: ${folderName} (${status}, ${duration}s)`);
    }

    // Limpieza: Eliminar de DB lo que ya no existe en disco
    const dbRecordings = dbService.getAllRecordings();
    for (const rec of dbRecordings) {
      if (!folders.includes(rec.relative_path)) {
        dbService.deleteRecording(rec.relative_path);
        console.log(`[Migration] Eliminado de DB (no existe en disco): ${rec.relative_path}`);
      }
    }
    
    console.log('[Migration] Sincronización completada.');
  }
}

module.exports = new MigrationService();
