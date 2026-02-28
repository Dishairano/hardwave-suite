import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '3306'),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

// Connection is validated lazily on first query — no startup test needed.

export async function query<T>(sql: string, params?: any[]): Promise<T> {
  try {
    // Use pool.query() instead of pool.execute() to avoid prepared statement issues with LIMIT/OFFSET
    const [results] = await pool.query(sql, params);
    return results as T;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

export async function queryOne<T>(sql: string, params?: any[]): Promise<T | null> {
  try {
    // Use pool.query() instead of pool.execute() to avoid prepared statement issues with LIMIT/OFFSET
    const [results] = await pool.query(sql, params);
    const rows = results as any[];
    return rows.length > 0 ? rows[0] as T : null;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

export default pool;
