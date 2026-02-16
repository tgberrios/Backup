import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  timeout: 60000,
  headers: { "Content-Type": "application/json" },
});

export interface BackupEntry {
  backup_id: number;
  backup_name: string;
  db_engine: string;
  connection_string?: string;
  database_name: string;
  backup_type: "structure" | "data" | "full" | "config";
  file_path: string;
  file_size?: number;
  status: "pending" | "in_progress" | "completed" | "failed";
  error_message?: string;
  created_at: string;
  completed_at?: string;
  cron_schedule?: string;
  is_scheduled?: boolean;
  next_run_at?: string;
  last_run_at?: string;
  run_count?: number;
}

export const backupsApi = {
  getAll: async (params?: {
    db_engine?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get("/backups", { params });
    return response.data;
  },
  get: async (id: number) => {
    const response = await api.get(`/backups/${id}`);
    return response.data;
  },
  create: async (backup: {
    backup_name: string;
    db_engine: string;
    connection_string: string;
    database_name: string;
    backup_type: "structure" | "data" | "full" | "config";
    cron_schedule?: string;
  }) => {
    const response = await api.post("/backups/create", backup);
    return response.data;
  },
  restore: async (
    id: number,
    target?: { target_connection_string?: string; target_database_name?: string }
  ) => {
    const response = await api.post(`/backups/${id}/restore`, target || {});
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/backups/${id}`);
    return response.data;
  },
  getHistory: async (id: number, limit = 50) => {
    const response = await api.get(`/backups/${id}/history`, { params: { limit } });
    return response.data;
  },
  updateSchedule: async (
    id: number,
    cron_schedule: string | null,
    is_scheduled: boolean
  ) => {
    const response = await api.put(`/backups/${id}/schedule`, {
      cron_schedule,
      is_scheduled,
    });
    return response.data;
  },
  enableSchedule: async (id: number) => {
    const response = await api.post(`/backups/${id}/enable-schedule`);
    return response.data;
  },
  disableSchedule: async (id: number) => {
    const response = await api.post(`/backups/${id}/disable-schedule`);
    return response.data;
  },
  testConnection: async (db_engine: string, connection_string: string) => {
    const response = await api.post("/test-connection", {
      db_engine,
      connection_string,
    });
    return response.data;
  },
  discoverDatabases: async (db_engine: string, connection_string: string) => {
    const response = await api.post("/discover-databases", {
      db_engine,
      connection_string,
    });
    return response.data;
  },
};
