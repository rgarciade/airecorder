const dbService = require('./electron/database/dbService');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// Mock app.getPath for dbService init if needed, but we can pass absolute path
// We need to know where the DB is.
// Based on logs/env, it's likely /Users/raul.garciad/Library/Application Support/Electron/recordings.db 
// OR /Users/raul.garciad/Library/Application Support/airecorder/recordings.db if packaged?
// But in dev mode it might be different. 
// main.js: const userDataPath = app.getPath('userData');
// Let's try to find it.

const USER_HOME = process.env.HOME;
const DB_PATH_DEV = path.join(USER_HOME, 'Library/Application Support/Electron/recordings.db');
const RECORDINGS_PATH = '/Users/raul.garciad/Desktop/recorder/grabaciones'; // Default guess or from settings

console.log('Checking DB at:', DB_PATH_DEV);

if (dbService.init(DB_PATH_DEV)) {
    console.log('DB Initialized');
    
    const recordings = dbService.getAllRecordings();
    console.log(`Found ${recordings.length} recordings`);

    recordings.forEach(rec => {
        if (!rec.duration || rec.duration === 0) {
            console.log(`Recording ${rec.relative_path} has duration 0 or null.`);
            
            const jsonPath = path.join(RECORDINGS_PATH, rec.relative_path, 'analysis', 'transcripcion_combinada.json');
            if (fs.existsSync(jsonPath)) {
                try {
                    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                    if (data.metadata && data.metadata.total_duration) {
                        console.log(`  Found JSON with duration: ${data.metadata.total_duration}`);
                        // dbService.updateDuration(rec.relative_path, data.metadata.total_duration);
                    } else {
                        console.log(`  JSON found but no total_duration in metadata`);
                    }
                } catch (e) {
                    console.log(`  Error reading JSON: ${e.message}`);
                }
            } else {
                console.log(`  No analysis JSON found at ${jsonPath}`);
            }
        }
    });

} else {
    console.error('Failed to init DB');
}
