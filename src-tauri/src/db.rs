use rusqlite::{Connection, Result, params};
use crate::models::{File, FileUpdate, Tag, Collection, CollectionWithFiles, Stats};

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new() -> Result<Self> {
        let db_path = dirs::data_local_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("."))
            .join("hardwave-suite")
            .join("library.db");

        // Create directory if it doesn't exist
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).ok();
        }

        let conn = Connection::open(&db_path)?;

        // Initialize schema
        conn.execute_batch(
            "
            -- Files table
            CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT UNIQUE NOT NULL,
                filename TEXT NOT NULL,
                file_type TEXT NOT NULL,
                file_extension TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                hash TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                modified_at INTEGER NOT NULL,
                indexed_at INTEGER NOT NULL,
                duration REAL,
                sample_rate INTEGER,
                bit_depth INTEGER,
                channels INTEGER,
                bpm REAL,
                detected_key TEXT,
                detected_scale TEXT,
                energy_level REAL,
                notes TEXT,
                rating INTEGER DEFAULT 0,
                color_code TEXT,
                is_favorite INTEGER DEFAULT 0,
                use_count INTEGER DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_files_filename ON files(filename);
            CREATE INDEX IF NOT EXISTS idx_files_file_type ON files(file_type);
            CREATE INDEX IF NOT EXISTS idx_files_bpm ON files(bpm);
            CREATE INDEX IF NOT EXISTS idx_files_hash ON files(hash);
            CREATE INDEX IF NOT EXISTS idx_files_is_favorite ON files(is_favorite);

            -- Tags table
            CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                category TEXT DEFAULT 'custom',
                color TEXT,
                created_at INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
            CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category);

            -- File-Tag junction table
            CREATE TABLE IF NOT EXISTS file_tags (
                file_id INTEGER NOT NULL,
                tag_id INTEGER NOT NULL,
                PRIMARY KEY (file_id, tag_id),
                FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_file_tags_file ON file_tags(file_id);
            CREATE INDEX IF NOT EXISTS idx_file_tags_tag ON file_tags(tag_id);

            -- Collections table
            CREATE TABLE IF NOT EXISTS collections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                color TEXT,
                is_smart INTEGER DEFAULT 0,
                smart_query TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_collections_name ON collections(name);

            -- Collection-File junction table
            CREATE TABLE IF NOT EXISTS collection_files (
                collection_id INTEGER NOT NULL,
                file_id INTEGER NOT NULL,
                added_at INTEGER NOT NULL,
                PRIMARY KEY (collection_id, file_id),
                FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
                FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_collection_files_collection ON collection_files(collection_id);
            CREATE INDEX IF NOT EXISTS idx_collection_files_file ON collection_files(file_id);

            -- Full-text search
            CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
                filename, notes, detected_key,
                content='files',
                content_rowid='id'
            );

            CREATE TRIGGER IF NOT EXISTS files_ai AFTER INSERT ON files BEGIN
                INSERT INTO files_fts(rowid, filename, notes, detected_key)
                VALUES (new.id, new.filename, new.notes, new.detected_key);
            END;

            CREATE TRIGGER IF NOT EXISTS files_ad AFTER DELETE ON files BEGIN
                INSERT INTO files_fts(files_fts, rowid, filename, notes, detected_key)
                VALUES('delete', old.id, old.filename, old.notes, old.detected_key);
            END;

            CREATE TRIGGER IF NOT EXISTS files_au AFTER UPDATE ON files BEGIN
                INSERT INTO files_fts(files_fts, rowid, filename, notes, detected_key)
                VALUES('delete', old.id, old.filename, old.notes, old.detected_key);
                INSERT INTO files_fts(rowid, filename, notes, detected_key)
                VALUES (new.id, new.filename, new.notes, new.detected_key);
            END;
            "
        )?;

        Ok(Self { conn })
    }

    // ==================== FILE OPERATIONS ====================

    pub fn get_files(&self, limit: i64, offset: i64) -> Result<Vec<File>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, file_path, filename, file_type, file_extension, file_size, hash,
                    created_at, modified_at, indexed_at, duration, sample_rate, bit_depth,
                    channels, bpm, detected_key, detected_scale, energy_level, notes,
                    rating, color_code, is_favorite, use_count
             FROM files ORDER BY indexed_at DESC LIMIT ? OFFSET ?"
        )?;

        let files = stmt.query_map([limit, offset], |row| {
            Self::row_to_file(row)
        })?.collect::<Result<Vec<_>>>()?;

        Ok(files)
    }

    pub fn get_file_by_id(&self, id: i64) -> Result<Option<File>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, file_path, filename, file_type, file_extension, file_size, hash,
                    created_at, modified_at, indexed_at, duration, sample_rate, bit_depth,
                    channels, bpm, detected_key, detected_scale, energy_level, notes,
                    rating, color_code, is_favorite, use_count
             FROM files WHERE id = ?"
        )?;

        let mut rows = stmt.query([id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(Self::row_to_file(row)?))
        } else {
            Ok(None)
        }
    }

    pub fn search_files(&self, query: &str, limit: i64, offset: i64) -> Result<Vec<File>> {
        let mut stmt = self.conn.prepare(
            "SELECT f.id, f.file_path, f.filename, f.file_type, f.file_extension, f.file_size,
                    f.hash, f.created_at, f.modified_at, f.indexed_at, f.duration, f.sample_rate,
                    f.bit_depth, f.channels, f.bpm, f.detected_key, f.detected_scale,
                    f.energy_level, f.notes, f.rating, f.color_code, f.is_favorite, f.use_count
             FROM files f
             JOIN files_fts fts ON f.id = fts.rowid
             WHERE files_fts MATCH ?
             ORDER BY rank LIMIT ? OFFSET ?"
        )?;

        let search_query = format!("{}*", query);
        let files = stmt.query_map(params![&search_query, limit, offset], |row| {
            Self::row_to_file(row)
        })?.collect::<Result<Vec<_>>>()?;

        Ok(files)
    }

    pub fn insert_file(&self, file: &File) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO files (file_path, filename, file_type, file_extension, file_size,
                               hash, created_at, modified_at, indexed_at, duration,
                               sample_rate, bit_depth, channels, bpm, detected_key,
                               detected_scale, energy_level, notes, rating, color_code,
                               is_favorite, use_count)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22)",
            params![
                file.file_path, file.filename, file.file_type, file.file_extension,
                file.file_size, file.hash, file.created_at, file.modified_at,
                file.indexed_at, file.duration, file.sample_rate, file.bit_depth,
                file.channels, file.bpm, file.detected_key, file.detected_scale,
                file.energy_level, file.notes, file.rating, file.color_code,
                if file.is_favorite { 1 } else { 0 }, file.use_count
            ]
        )?;

        Ok(self.conn.last_insert_rowid())
    }

    pub fn update_file(&self, id: i64, updates: &FileUpdate) -> Result<()> {
        let mut sql = String::from("UPDATE files SET ");
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![];
        let mut first = true;

        macro_rules! add_field {
            ($field:expr, $name:expr) => {
                if let Some(ref val) = $field {
                    if !first { sql.push_str(", "); }
                    sql.push_str(concat!($name, " = ?"));
                    params.push(Box::new(val.clone()));
                    first = false;
                }
            };
        }

        add_field!(updates.notes, "notes");
        add_field!(updates.color_code, "color_code");
        add_field!(updates.detected_key, "detected_key");

        if let Some(rating) = updates.rating {
            if !first { sql.push_str(", "); }
            sql.push_str("rating = ?");
            params.push(Box::new(rating));
            first = false;
        }

        if let Some(is_favorite) = updates.is_favorite {
            if !first { sql.push_str(", "); }
            sql.push_str("is_favorite = ?");
            params.push(Box::new(if is_favorite { 1 } else { 0 }));
            first = false;
        }

        if let Some(bpm) = updates.bpm {
            if !first { sql.push_str(", "); }
            sql.push_str("bpm = ?");
            params.push(Box::new(bpm));
            first = false;
        }

        if first {
            return Ok(()); // No updates
        }

        sql.push_str(" WHERE id = ?");
        params.push(Box::new(id));

        let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        self.conn.execute(&sql, params_refs.as_slice())?;

        Ok(())
    }

    pub fn delete_file(&self, id: i64) -> Result<()> {
        self.conn.execute("DELETE FROM files WHERE id = ?", [id])?;
        Ok(())
    }

    pub fn delete_files(&self, ids: &[i64]) -> Result<usize> {
        let placeholders: Vec<String> = ids.iter().map(|_| "?".to_string()).collect();
        let sql = format!("DELETE FROM files WHERE id IN ({})", placeholders.join(","));

        let params: Vec<&dyn rusqlite::ToSql> = ids.iter().map(|id| id as &dyn rusqlite::ToSql).collect();
        let deleted = self.conn.execute(&sql, params.as_slice())?;
        Ok(deleted)
    }

    fn row_to_file(row: &rusqlite::Row) -> Result<File> {
        Ok(File {
            id: Some(row.get(0)?),
            file_path: row.get(1)?,
            filename: row.get(2)?,
            file_type: row.get(3)?,
            file_extension: row.get(4)?,
            file_size: row.get(5)?,
            hash: row.get(6)?,
            created_at: row.get(7)?,
            modified_at: row.get(8)?,
            indexed_at: row.get(9)?,
            duration: row.get(10)?,
            sample_rate: row.get(11)?,
            bit_depth: row.get(12)?,
            channels: row.get(13)?,
            bpm: row.get(14)?,
            detected_key: row.get(15)?,
            detected_scale: row.get(16)?,
            energy_level: row.get(17)?,
            notes: row.get(18)?,
            rating: row.get(19)?,
            color_code: row.get(20)?,
            is_favorite: row.get::<_, i32>(21)? != 0,
            use_count: row.get(22)?,
        })
    }

    // ==================== TAG OPERATIONS ====================

    pub fn get_tags(&self) -> Result<Vec<Tag>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, category, color, created_at FROM tags ORDER BY name"
        )?;

        let tags = stmt.query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                category: row.get(2)?,
                color: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?.collect::<Result<Vec<_>>>()?;

        Ok(tags)
    }

    pub fn create_tag(&self, name: &str, category: &str, color: &str) -> Result<Tag> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);

        self.conn.execute(
            "INSERT INTO tags (name, category, color, created_at) VALUES (?, ?, ?, ?)",
            params![name, category, color, now]
        )?;

        let id = self.conn.last_insert_rowid();
        Ok(Tag {
            id,
            name: name.to_string(),
            category: Some(category.to_string()),
            color: Some(color.to_string()),
            created_at: now,
        })
    }

    pub fn update_tag(&self, id: i64, name: Option<&str>, category: Option<&str>, color: Option<&str>) -> Result<()> {
        let mut sql = String::from("UPDATE tags SET ");
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![];
        let mut first = true;

        if let Some(n) = name {
            sql.push_str("name = ?");
            params.push(Box::new(n.to_string()));
            first = false;
        }
        if let Some(c) = category {
            if !first { sql.push_str(", "); }
            sql.push_str("category = ?");
            params.push(Box::new(c.to_string()));
            first = false;
        }
        if let Some(col) = color {
            if !first { sql.push_str(", "); }
            sql.push_str("color = ?");
            params.push(Box::new(col.to_string()));
        }

        sql.push_str(" WHERE id = ?");
        params.push(Box::new(id));

        let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        self.conn.execute(&sql, params_refs.as_slice())?;

        Ok(())
    }

    pub fn delete_tag(&self, id: i64) -> Result<()> {
        self.conn.execute("DELETE FROM tags WHERE id = ?", [id])?;
        Ok(())
    }

    pub fn tag_files(&self, file_ids: &[i64], tag_ids: &[i64]) -> Result<()> {
        for file_id in file_ids {
            for tag_id in tag_ids {
                self.conn.execute(
                    "INSERT OR IGNORE INTO file_tags (file_id, tag_id) VALUES (?, ?)",
                    params![file_id, tag_id]
                )?;
            }
        }
        Ok(())
    }

    pub fn untag_files(&self, file_ids: &[i64], tag_ids: &[i64]) -> Result<()> {
        for file_id in file_ids {
            for tag_id in tag_ids {
                self.conn.execute(
                    "DELETE FROM file_tags WHERE file_id = ? AND tag_id = ?",
                    params![file_id, tag_id]
                )?;
            }
        }
        Ok(())
    }

    pub fn get_file_tags(&self, file_id: i64) -> Result<Vec<Tag>> {
        let mut stmt = self.conn.prepare(
            "SELECT t.id, t.name, t.category, t.color, t.created_at
             FROM tags t
             JOIN file_tags ft ON t.id = ft.tag_id
             WHERE ft.file_id = ?
             ORDER BY t.name"
        )?;

        let tags = stmt.query_map([file_id], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                category: row.get(2)?,
                color: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?.collect::<Result<Vec<_>>>()?;

        Ok(tags)
    }

    pub fn get_files_by_tag(&self, tag_id: i64, limit: i64, offset: i64) -> Result<Vec<File>> {
        let mut stmt = self.conn.prepare(
            "SELECT f.id, f.file_path, f.filename, f.file_type, f.file_extension, f.file_size,
                    f.hash, f.created_at, f.modified_at, f.indexed_at, f.duration, f.sample_rate,
                    f.bit_depth, f.channels, f.bpm, f.detected_key, f.detected_scale,
                    f.energy_level, f.notes, f.rating, f.color_code, f.is_favorite, f.use_count
             FROM files f
             JOIN file_tags ft ON f.id = ft.file_id
             WHERE ft.tag_id = ?
             ORDER BY f.indexed_at DESC LIMIT ? OFFSET ?"
        )?;

        let files = stmt.query_map(params![tag_id, limit, offset], |row| {
            Self::row_to_file(row)
        })?.collect::<Result<Vec<_>>>()?;

        Ok(files)
    }

    // ==================== COLLECTION OPERATIONS ====================

    pub fn get_collections(&self) -> Result<Vec<Collection>> {
        let mut stmt = self.conn.prepare(
            "SELECT c.id, c.name, c.description, c.color, c.is_smart, c.smart_query,
                    c.created_at, c.updated_at,
                    (SELECT COUNT(*) FROM collection_files cf WHERE cf.collection_id = c.id) as file_count
             FROM collections c ORDER BY c.name"
        )?;

        let collections = stmt.query_map([], |row| {
            Ok(Collection {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                color: row.get(3)?,
                is_smart: row.get::<_, i32>(4)? != 0,
                smart_query: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
                file_count: row.get(8)?,
            })
        })?.collect::<Result<Vec<_>>>()?;

        Ok(collections)
    }

    pub fn get_collection_by_id(&self, id: i64) -> Result<Option<CollectionWithFiles>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, description, color, is_smart, smart_query, created_at, updated_at
             FROM collections WHERE id = ?"
        )?;

        let mut rows = stmt.query([id])?;
        if let Some(row) = rows.next()? {
            let collection = Collection {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                color: row.get(3)?,
                is_smart: row.get::<_, i32>(4)? != 0,
                smart_query: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
                file_count: 0, // Will be set below
            };

            let files = self.get_collection_files(id)?;
            Ok(Some(CollectionWithFiles {
                collection: Collection { file_count: files.len() as i64, ..collection },
                files,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn create_collection(&self, name: &str, description: Option<&str>, color: Option<&str>) -> Result<Collection> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);

        self.conn.execute(
            "INSERT INTO collections (name, description, color, is_smart, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)",
            params![name, description, color, now, now]
        )?;

        let id = self.conn.last_insert_rowid();
        Ok(Collection {
            id,
            name: name.to_string(),
            description: description.map(|s| s.to_string()),
            color: color.map(|s| s.to_string()),
            is_smart: false,
            smart_query: None,
            created_at: now,
            updated_at: now,
            file_count: 0,
        })
    }

    pub fn update_collection(&self, id: i64, name: Option<&str>, description: Option<&str>, color: Option<&str>) -> Result<()> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);

        let mut sql = String::from("UPDATE collections SET updated_at = ?");
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(now)];

        if let Some(n) = name {
            sql.push_str(", name = ?");
            params.push(Box::new(n.to_string()));
        }
        if let Some(d) = description {
            sql.push_str(", description = ?");
            params.push(Box::new(d.to_string()));
        }
        if let Some(c) = color {
            sql.push_str(", color = ?");
            params.push(Box::new(c.to_string()));
        }

        sql.push_str(" WHERE id = ?");
        params.push(Box::new(id));

        let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        self.conn.execute(&sql, params_refs.as_slice())?;

        Ok(())
    }

    pub fn delete_collection(&self, id: i64) -> Result<()> {
        self.conn.execute("DELETE FROM collections WHERE id = ?", [id])?;
        Ok(())
    }

    pub fn add_files_to_collection(&self, collection_id: i64, file_ids: &[i64]) -> Result<()> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);

        for file_id in file_ids {
            self.conn.execute(
                "INSERT OR IGNORE INTO collection_files (collection_id, file_id, added_at) VALUES (?, ?, ?)",
                params![collection_id, file_id, now]
            )?;
        }

        // Update collection's updated_at
        self.conn.execute(
            "UPDATE collections SET updated_at = ? WHERE id = ?",
            params![now, collection_id]
        )?;

        Ok(())
    }

    pub fn remove_files_from_collection(&self, collection_id: i64, file_ids: &[i64]) -> Result<()> {
        for file_id in file_ids {
            self.conn.execute(
                "DELETE FROM collection_files WHERE collection_id = ? AND file_id = ?",
                params![collection_id, file_id]
            )?;
        }

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);

        self.conn.execute(
            "UPDATE collections SET updated_at = ? WHERE id = ?",
            params![now, collection_id]
        )?;

        Ok(())
    }

    pub fn get_collection_files(&self, collection_id: i64) -> Result<Vec<File>> {
        let mut stmt = self.conn.prepare(
            "SELECT f.id, f.file_path, f.filename, f.file_type, f.file_extension, f.file_size,
                    f.hash, f.created_at, f.modified_at, f.indexed_at, f.duration, f.sample_rate,
                    f.bit_depth, f.channels, f.bpm, f.detected_key, f.detected_scale,
                    f.energy_level, f.notes, f.rating, f.color_code, f.is_favorite, f.use_count
             FROM files f
             JOIN collection_files cf ON f.id = cf.file_id
             WHERE cf.collection_id = ?
             ORDER BY cf.added_at DESC"
        )?;

        let files = stmt.query_map([collection_id], |row| {
            Self::row_to_file(row)
        })?.collect::<Result<Vec<_>>>()?;

        Ok(files)
    }

    // ==================== STATS ====================

    pub fn get_stats(&self) -> Result<Stats> {
        let total_files: i64 = self.conn.query_row("SELECT COUNT(*) FROM files", [], |row| row.get(0))?;
        let total_tags: i64 = self.conn.query_row("SELECT COUNT(*) FROM tags", [], |row| row.get(0))?;
        let total_collections: i64 = self.conn.query_row("SELECT COUNT(*) FROM collections", [], |row| row.get(0))?;
        let total_favorites: i64 = self.conn.query_row("SELECT COUNT(*) FROM files WHERE is_favorite = 1", [], |row| row.get(0))?;

        Ok(Stats {
            total_files,
            total_tags,
            total_collections,
            total_favorites,
        })
    }
}
