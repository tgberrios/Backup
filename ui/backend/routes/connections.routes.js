import express from "express";
import { Pool } from "pg";

const router = express.Router();

function connectionErrMessage(err) {
  if (err && typeof err === "object" && typeof err.message === "string") {
    return err.message;
  }
  return err != null ? String(err) : "Unknown error";
}

function parseConnectionString(connection_string) {
  const params = {};
  connection_string.split(";").forEach((param) => {
    const eq = param.indexOf("=");
    if (eq === -1) return;
    const key = param.substring(0, eq).trim().toLowerCase();
    const value = param.substring(eq + 1).trim();
    if (key && value) params[key] = value;
  });
  return params;
}

router.post("/test-connection", async (req, res) => {
  const { db_engine, connection_string } = req.body;
  if (!db_engine || !connection_string) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: db_engine and connection_string",
    });
  }
  const valid = ["PostgreSQL", "MariaDB", "MongoDB", "Oracle"].includes(db_engine);
  if (!valid) {
    return res.status(400).json({
      success: false,
      error: "Invalid db_engine. Must be one of: PostgreSQL, MariaDB, MongoDB, Oracle",
    });
  }

  let testResult = false;
  let message = "";

  try {
    switch (db_engine) {
      case "PostgreSQL": {
        let config;
        if (
          connection_string.includes("postgresql://") ||
          connection_string.includes("postgres://")
        ) {
          config = { connectionString: connection_string, connectionTimeoutMillis: 5000 };
        } else {
          const p = parseConnectionString(connection_string);
          config = {
            host: p.host || p.hostname || "localhost",
            port: p.port ? parseInt(p.port, 10) : 5432,
            user: p.user || p.username || "postgres",
            password: p.password || "",
            database: p.database || p.db || "postgres",
            connectionTimeoutMillis: 5000,
          };
        }
        const testPool = new Pool(config);
        const client = await testPool.connect();
        await client.query("SELECT 1");
        client.release();
        await testPool.end();
        testResult = true;
        message = "PostgreSQL connection successful!";
        break;
      }
      case "MariaDB": {
        const mysql = (await import("mysql2/promise")).default;
        const p = parseConnectionString(connection_string);
        const conn = await mysql.createConnection({
          host: p.host || p.hostname || "localhost",
          port: p.port ? parseInt(p.port, 10) : 3306,
          user: p.user || p.username || "root",
          password: p.password || "",
          database: p.db || p.database || "",
          connectTimeout: 5000,
        });
        await conn.query("SELECT 1");
        await conn.end();
        testResult = true;
        message = "MariaDB connection successful!";
        break;
      }
      case "MongoDB": {
        const { MongoClient } = await import("mongodb");
        const client = new MongoClient(connection_string, { serverSelectionTimeoutMS: 5000 });
        await client.connect();
        await client.db().admin().ping();
        await client.close();
        testResult = true;
        message = "MongoDB connection successful!";
        break;
      }
      case "Oracle": {
        const oracledbModule = await import("oracledb").catch(() => null);
        if (!oracledbModule) {
          message =
            "Oracle driver (oracledb) is not installed. Install with: npm install oracledb";
          break;
        }
        const oracledb = oracledbModule.default;
        const p = parseConnectionString(connection_string);
        const connection = await oracledb.getConnection({
          user: p.user || "",
          password: p.password || "",
          connectString: `${p.host || "localhost"}:${p.port || 1521}/${p.db || p.database || ""}`,
          connectionTimeout: 5000,
        });
        await connection.execute("SELECT 1 FROM DUAL");
        await connection.close();
        testResult = true;
        message = "Oracle connection successful!";
        break;
      }
    }
  } catch (err) {
    message = `${db_engine} connection failed: ${connectionErrMessage(err)}`;
  }

  res.json({ success: testResult, message });
});

router.post("/discover-databases", async (req, res) => {
  const { db_engine, connection_string } = req.body;
  if (!db_engine || !connection_string) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: db_engine and connection_string",
    });
  }

  let databases = [];
  try {
    switch (db_engine) {
      case "PostgreSQL": {
        let config;
        if (
          connection_string.includes("postgresql://") ||
          connection_string.includes("postgres://")
        ) {
          config = { connectionString: connection_string, connectionTimeoutMillis: 5000 };
        } else {
          const p = parseConnectionString(connection_string);
          config = {
            host: p.host || p.hostname || "localhost",
            port: p.port ? parseInt(p.port, 10) : 5432,
            user: p.user || p.username || "postgres",
            password: p.password || "",
            database: p.database || p.db || "postgres",
            connectionTimeoutMillis: 5000,
          };
        }
        const testPool = new Pool(config);
        const result = await testPool.query(
          "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname"
        );
        databases = result.rows.map((row) => row.datname);
        await testPool.end();
        break;
      }
      case "MariaDB": {
        const mysql = (await import("mysql2/promise")).default;
        const p = parseConnectionString(connection_string);
        const conn = await mysql.createConnection({
          host: p.host || p.hostname || "localhost",
          port: p.port ? parseInt(p.port, 10) : 3306,
          user: p.user || p.username || "root",
          password: p.password || "",
          database: p.db || p.database || "",
          connectTimeout: 5000,
        });
        const [rows] = await conn.query("SHOW DATABASES");
        databases = rows
          .map((row) => Object.values(row)[0])
          .filter(
            (db) =>
              !["information_schema", "performance_schema", "mysql", "sys"].includes(db)
          );
        await conn.end();
        break;
      }
      case "MongoDB": {
        const { MongoClient } = await import("mongodb");
        const client = new MongoClient(connection_string, { serverSelectionTimeoutMS: 5000 });
        await client.connect();
        const dbs = await client.db().admin().listDatabases();
        databases = dbs.databases
          .map((db) => db.name)
          .filter((name) => !["admin", "local", "config"].includes(name));
        await client.close();
        break;
      }
      case "Oracle":
        return res.status(400).json({
          success: false,
          error: "Database discovery not implemented for Oracle in Backup UI",
        });
      default:
        return res.status(400).json({
          success: false,
          error: `Unsupported db_engine: ${db_engine}`,
        });
    }
    res.json({ success: true, databases });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: `Failed to discover databases: ${err.message}`,
    });
  }
});

export default router;
