// Armazenamento de alertas, inscrições de push e chaves (VAPID).
// Mesmo padrão da carteira: com DATABASE_URL usa Postgres (durável/compartilhado);
// sem ela, arquivo JSON local (funciona na hora; no Render grátis é volátil).

import fs from "node:fs";
import path from "node:path";

export type AssetType = "cripto" | "acao";
export type Metric = "preco" | "variacao24h" | "rsi";
export type Op = ">=" | "<=";

export interface Alert {
  id: string;
  symbol: string;
  assetType: AssetType;
  metric: Metric;
  op: Op;
  value: number;
  person?: string;
  createdAt: string;
  triggered?: boolean;
  triggeredAt?: string;
}

export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: string;
}

interface AlertRepo {
  getAlerts(): Promise<Alert[]>;
  addAlert(a: Alert): Promise<void>;
  removeAlert(id: string): Promise<boolean>;
  setTriggered(id: string, at: string): Promise<void>;
  getSubs(): Promise<PushSub[]>;
  addSub(s: PushSub): Promise<void>;
  removeSub(endpoint: string): Promise<boolean>;
  getKv(key: string): Promise<string | null>;
  setKv(key: string, value: string): Promise<void>;
}

interface JsonShape {
  alerts: Alert[];
  subs: PushSub[];
  kv: Record<string, string>;
}

class JsonAlertRepo implements AlertRepo {
  private file = path.join(process.cwd(), "alerts-data.json");
  private read(): JsonShape {
    try {
      const d = JSON.parse(fs.readFileSync(this.file, "utf8"));
      return { alerts: d.alerts || [], subs: d.subs || [], kv: d.kv || {} };
    } catch {
      return { alerts: [], subs: [], kv: {} };
    }
  }
  private write(d: JsonShape) { fs.writeFileSync(this.file, JSON.stringify(d, null, 2)); }

  async getAlerts() { return this.read().alerts; }
  async addAlert(a: Alert) { const d = this.read(); d.alerts.push(a); this.write(d); }
  async removeAlert(id: string) {
    const d = this.read(); const before = d.alerts.length;
    d.alerts = d.alerts.filter((x) => x.id !== id); this.write(d);
    return d.alerts.length !== before;
  }
  async setTriggered(id: string, at: string) {
    const d = this.read();
    d.alerts = d.alerts.map((x) => (x.id === id ? { ...x, triggered: true, triggeredAt: at } : x));
    this.write(d);
  }
  async getSubs() { return this.read().subs; }
  async addSub(s: PushSub) {
    const d = this.read();
    if (!d.subs.some((x) => x.endpoint === s.endpoint)) d.subs.push(s);
    this.write(d);
  }
  async removeSub(endpoint: string) {
    const d = this.read(); const before = d.subs.length;
    d.subs = d.subs.filter((x) => x.endpoint !== endpoint); this.write(d);
    return d.subs.length !== before;
  }
  async getKv(key: string) { return this.read().kv[key] ?? null; }
  async setKv(key: string, value: string) { const d = this.read(); d.kv[key] = value; this.write(d); }
}

class PgAlertRepo implements AlertRepo {
  private pool: any;
  private ready: Promise<void>;
  constructor(url: string) {
    this.ready = (async () => {
      const { Pool } = await import("pg");
      this.pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
      await this.pool.query(`CREATE TABLE IF NOT EXISTS alerts (
        id text primary key, symbol text not null, asset_type text not null, metric text not null,
        op text not null, value double precision not null, person text, created_at text not null,
        triggered boolean default false, triggered_at text)`);
      await this.pool.query(`CREATE TABLE IF NOT EXISTS push_subs (
        endpoint text primary key, p256dh text not null, auth text not null, created_at text not null)`);
      await this.pool.query(`CREATE TABLE IF NOT EXISTS kv (key text primary key, value text not null)`);
    })();
  }
  private map(r: any): Alert {
    return {
      id: r.id, symbol: r.symbol, assetType: r.asset_type, metric: r.metric, op: r.op,
      value: Number(r.value), person: r.person ?? undefined, createdAt: r.created_at,
      triggered: r.triggered ?? false, triggeredAt: r.triggered_at ?? undefined,
    };
  }
  async getAlerts() {
    await this.ready;
    const r = await this.pool.query("select * from alerts order by created_at asc");
    return r.rows.map((x: any) => this.map(x)) as Alert[];
  }
  async addAlert(a: Alert) {
    await this.ready;
    await this.pool.query(
      "insert into alerts (id,symbol,asset_type,metric,op,value,person,created_at,triggered) values ($1,$2,$3,$4,$5,$6,$7,$8,false)",
      [a.id, a.symbol, a.assetType, a.metric, a.op, a.value, a.person ?? null, a.createdAt]
    );
  }
  async removeAlert(id: string) {
    await this.ready;
    const r = await this.pool.query("delete from alerts where id=$1", [id]);
    return (r.rowCount ?? 0) > 0;
  }
  async setTriggered(id: string, at: string) {
    await this.ready;
    await this.pool.query("update alerts set triggered=true, triggered_at=$2 where id=$1", [id, at]);
  }
  async getSubs() {
    await this.ready;
    const r = await this.pool.query("select * from push_subs");
    return r.rows.map((x: any) => ({ endpoint: x.endpoint, keys: { p256dh: x.p256dh, auth: x.auth }, createdAt: x.created_at })) as PushSub[];
  }
  async addSub(s: PushSub) {
    await this.ready;
    await this.pool.query(
      "insert into push_subs (endpoint,p256dh,auth,created_at) values ($1,$2,$3,$4) on conflict (endpoint) do nothing",
      [s.endpoint, s.keys.p256dh, s.keys.auth, s.createdAt]
    );
  }
  async removeSub(endpoint: string) {
    await this.ready;
    const r = await this.pool.query("delete from push_subs where endpoint=$1", [endpoint]);
    return (r.rowCount ?? 0) > 0;
  }
  async getKv(key: string) {
    await this.ready;
    const r = await this.pool.query("select value from kv where key=$1", [key]);
    return r.rows[0]?.value ?? null;
  }
  async setKv(key: string, value: string) {
    await this.ready;
    await this.pool.query("insert into kv (key,value) values ($1,$2) on conflict (key) do update set value=$2", [key, value]);
  }
}

export const alertRepo: AlertRepo = process.env.DATABASE_URL ? new PgAlertRepo(process.env.DATABASE_URL) : new JsonAlertRepo();
