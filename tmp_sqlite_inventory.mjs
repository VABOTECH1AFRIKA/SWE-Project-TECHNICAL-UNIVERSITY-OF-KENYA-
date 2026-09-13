import Database from 'better-sqlite3';
const db = new Database('D:\\PROJECTS\\StudyHub_AI\\StudyHub_AI\\studyhub.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
for (const { name } of tables) {
  const count = db.prepare(`SELECT COUNT(*) AS c FROM ${name}`).get().c;
  console.log(name + '\t' + count);
}
db.close();
