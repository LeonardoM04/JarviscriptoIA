// Armazenamento das transações da carteira do grupo.
// Com DATABASE_URL -> Postgres (permanente e compartilhado). Sem ela -> arquivo
// JSON local (funciona na hora; no Render grátis é volátil até ligar o Postgres).

import fs from "node:fs";
import path from "node:path";

export interface Tx {
  id: string;
  symbol: string;
  assetType: "cripto" | "acao";
  side: "compra" | "venda";
  quantity: number;
  price: number;
  person: string;
  note?: string;
  createdAt: string;
}

interface Repo {
  getAll(): Promise<Tx[]>;
  add(tx: Tx): Promise<void>;
  remove(id: string): Promise<boolean>;
}

class JsonRepo implements Repo {
  private file = path.join(process.cwd(), "portfolio-data.json");
  private read(): Tx[] {
    try { return JSON.parse(fs.readFileSync(this.file, "utf8")); } catch { return []; }
  }
  private write(list: Tx[]) { fs.writeFileSync(this.file, JSON.stringify(list, null, 2)); }
  async getAll() { return this.read().sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)); }
  async add(tx: Tx) { const l = this.read(); l.push(tx); this.write(l); }
  async remove(id: string) { const l = this.read(); const n = l.filter((t) => t.id !== id); this.write(n); return n.length !== l.length; }
}

class PgRepo implements Repo {
  private pool: any;
  private ready: Promise<void>;
  constructor(url: string) {
    this.ready = (async () => {
      const { Pool } = await import("pg");
      this.pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
      await this.pool.query(`CREATE TABLE IF NOT EXISTS transactions (
        id text primary key, symbol text not null, asset_type text not null, side text not null,
        quantity double precision not null, price double precision not null, person text not null,
        note text, created_at text not null)`);
    })();
  }
  async getAll() {
    await this.ready;
    const r = await this.pool.query("select * from transactions order by created_at asc");
    return r.rows.map((x: any) => ({
      id: x.id, symbol: x.symbol, assetType: x.asset_type, side: x.side,
      quantity: Number(x.quantity), price: Number(x.price), person: x.person,
      note: x.note ?? undefined, createdAt: x.created_at,
    })) as Tx[];
  }
  async add(tx: Tx) {
    await this.ready;
    await this.pool.query(
      "insert into transactions (id,symbol,asset_type,side,quantity,price,person,note,created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [tx.id, tx.symbol, tx.assetType, tx.side, tx.quantity, tx.price, tx.person, tx.note ?? null, tx.createdAt]
    );
  }
  async remove(id: string) {
    await this.ready;
    const r = await this.pool.query("delete from transactions where id=$1", [id]);
    return (r.rowCount ?? 0) > 0;
  }
}

export const repo: Repo = process.env.DATABASE_URL ? new PgRepo(process.env.DATABASE_URL) : new JsonRepo();
export const storageMode = process.env.DATABASE_URL ? "postgres" : "local";
