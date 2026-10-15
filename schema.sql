-- ============================================
-- RADAR GROUP SaaS — Схема базы данных
-- ============================================

-- КЛИЕНТЫ (компании-заказчики)
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  company TEXT,
  site_url TEXT,
  status TEXT DEFAULT 'active',
  plan TEXT DEFAULT 'basic',
  language TEXT DEFAULT 'ru',
  currency TEXT DEFAULT 'USD',
  api_key TEXT UNIQUE,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- ПОЛЬЗОВАТЕЛИ (логины для входа)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'client',
  language TEXT DEFAULT 'ru',
  created_at INTEGER DEFAULT (unixepoch()),
  last_login INTEGER,
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- НАСТРОЙКИ КЛИЕНТА (промпт, ключи, виджет)
CREATE TABLE IF NOT EXISTS settings (
  client_id TEXT PRIMARY KEY,
  prompt_ru TEXT,
  prompt_en TEXT,
  openai_api_key TEXT,
  telegram_token TEXT,
  telegram_admin_id INTEGER,
  telegram_bot_username TEXT,
  widget_color TEXT DEFAULT '#00F0FF',
  widget_title_ru TEXT DEFAULT 'ИИ-менеджер',
  widget_title_en TEXT DEFAULT 'AI Manager',
  widget_welcome_ru TEXT DEFAULT 'Здравствуйте! Чем помочь?',
  widget_welcome_en TEXT DEFAULT 'Hello! How can I help?',
  widget_position TEXT DEFAULT 'right',
  webhook_url TEXT,
  webhook_secret TEXT,
  notification_email TEXT,
  max_daily_requests INTEGER DEFAULT 1000,
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- ДИАЛОГИ (переписки)
CREATE TABLE IF NOT EXISTS dialogs (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  channel TEXT DEFAULT 'widget',
  user_uid TEXT,
  user_name TEXT,
  user_contact TEXT,
  status TEXT DEFAULT 'active',
  is_lead INTEGER DEFAULT 0,
  lead_data TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- СООБЩЕНИЯ (внутри диалогов)
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  dialog_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  cost_usd REAL DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (dialog_id) REFERENCES dialogs(id)
);

-- СОБЫТИЯ (аналитика)
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  dialog_id TEXT,
  language TEXT,
  metadata TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

-- ОПЛАТЫ
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending',
  plan TEXT,
  period_start INTEGER,
  period_end INTEGER,
  payment_method TEXT,
  provider TEXT,
  external_id TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  paid_at INTEGER,
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- ЛОГИ (ошибки, отладка)
CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  client_id TEXT,
  level TEXT NOT NULL,
  source TEXT,
  message TEXT NOT NULL,
  metadata TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

-- ИНДЕКСЫ (для скорости)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_client ON users(client_id);
CREATE INDEX IF NOT EXISTS idx_clients_api_key ON clients(api_key);
CREATE INDEX IF NOT EXISTS idx_dialogs_client ON dialogs(client_id);
CREATE INDEX IF NOT EXISTS idx_dialogs_status ON dialogs(client_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_dialog ON messages(dialog_id);
CREATE INDEX IF NOT EXISTS idx_events_client ON events(client_id, created_at);
CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_logs_client ON logs(client_id, created_at);