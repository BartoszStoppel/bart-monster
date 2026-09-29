import { difficultyTier } from "@/lib/metrics";
import {
  action,
  bootstrap,
  session,
  signIn,
  signOut,
  request,
  metric,
  type Row,
} from "@/lib/api";
import { buildUserTierData } from "@/app/(app)/community/build-user-tier-data";
import { computeAlignments } from "@/app/(app)/community/compute-alignment";
type Result = { data: any; error: { message: string } | null; count?: number };
class Query implements PromiseLike<Result> {
  private filters: Array<(r: Row) => boolean> = [];
  private ordering: Array<{ field: string; ascending: boolean }> = [];
  private one = false;
  private fields = "*";
  private operation = "select";
  private values: any;
  constructor(private table: string) {}
  select(fields = "*", _options?: unknown) {
    this.fields = fields;
    return this;
  }
  eq(field: string, value: any) {
    this.filters.push(
      (r) =>
        r[field] === value ||
        (r[field] != null &&
          value != null &&
          String(r[field]) === String(value)),
    );
    return this;
  }
  in(field: string, values: any[]) {
    const set = new Set(values.map(String));
    this.filters.push((r) => set.has(String(r[field])));
    return this;
  }
  not(field: string, op: string, value: any) {
    if (op !== "is") throw new Error("Unsupported query");
    this.filters.push((r) => r[field] !== value);
    return this;
  }
  order(field: string, options: { ascending?: boolean } = {}) {
    this.ordering.push({ field, ascending: options.ascending !== false });
    return this;
  }
  limit(_count: number) {
    return this;
  } // Data is already complete; never truncate historical or ranking state.
  single() {
    this.one = true;
    return this;
  }
  maybeSingle() {
    this.one = true;
    return this;
  }
  upsert(values: any, _options?: unknown) {
    this.operation = "upsert";
    this.values = values;
    return this;
  }
  insert(values: any) {
    this.operation = "insert";
    this.values = values;
    return this;
  }
  update(values: any) {
    this.operation = "update";
    this.values = values;
    return this;
  }
  delete() {
    this.operation = "delete";
    return this;
  }
  async execute(): Promise<Result> {
    try {
      const state = await bootstrap();
      let rows: Row[];
      if (this.table === "score_snapshots") {
        const h = await request(`/api/history?metric=${metric()}`);
        rows = Array.isArray(h) ? h : (h.snapshots ?? h.rows ?? []);
      } else if (this.table === "user_alignments") {
        rows = [];
        const profiles = (state.tables.profiles ?? []).filter(
          (p) => p.is_active !== false,
        );
        const profilesMap = new Map(profiles.map((p) => [p.id, p]));
        for (const category of ["board", "party"]) {
          const games = new Map(
            (state.tables.board_games ?? [])
              .filter((g) => g.category === category)
              .map((g) => [g.bgg_id, g]),
          );
          const users = buildUserTierData(
            (state.tables.tier_placements ?? []) as any,
            games as any,
            profilesMap as any,
            new Map(),
          );
          rows.push(
            ...computeAlignments(users).map((r) => ({
              user_id: r.userId,
              category,
              display_name: r.displayName,
              avatar_url: r.avatarUrl,
              allies: r.allies,
              rivals: r.rivals,
            })),
          );
        }
      } else rows = state.tables[this.table] ?? [];
      if (this.table === "difficulty_placements")
        rows = rows.map((r) => ({
          ...r,
          tier: difficultyTier(r.tier),
          score: Number(r.tier),
        }));
      rows = rows.filter((r) => this.filters.every((test) => test(r)));
      if (this.operation !== "select") {
        const values = Array.isArray(this.values) ? this.values : [this.values];
        const targets =
          this.operation === "update"
            ? rows.map((r) => ({ ...r, ...this.values }))
            : values;
        for (const row of targets) {
          if (this.table === "user_game_collection") {
            const supplied = this.operation === "update" ? this.values : row;
            const args: Row = { bggId: row.bgg_id };
            for (const key of [
              "owned",
              "wishlist",
              "wishlist_priority",
              "wishlist_note",
            ])
              if (key in supplied) args[key] = supplied[key];
            await action("updateCollection", args, false);
          } else if (this.table === "profiles")
            await action(
              "updateProfile",
              { display_name: row.display_name },
              false,
            );
          else if (this.table === "board_games" && this.operation === "update")
            await action(
              "updateCategory",
              { bggId: row.bgg_id, category: row.category },
              false,
            );
          else if (this.table === "board_games" && this.operation === "upsert")
            await action(
              "addGame",
              { game: row, category: row.category },
              false,
            );
          else throw new Error(`Unsupported ${this.table} mutation`);
        }
        return { data: targets, error: null };
      }
      for (const sort of this.ordering.slice().reverse())
        rows.sort((a, b) => {
          const av = a[sort.field],
            bv = b[sort.field];
          const diff =
            typeof av === "number" && typeof bv === "number"
              ? av - bv
              : String(av ?? "").localeCompare(String(bv ?? ""));
          return sort.ascending ? diff : -diff;
        });
      if (this.fields.includes("profiles("))
        rows = rows.map((r) => ({
          ...r,
          profiles: (state.tables.profiles ?? []).find(
            (p) => p.id === r.user_id,
          ) ?? { display_name: "Unknown", avatar_url: null },
        }));
      if (/board_games(?:!inner)?\(/.test(this.fields))
        rows = rows.map((r) => ({
          ...r,
          board_games:
            (state.tables.board_games ?? []).find(
              (g) => g.bgg_id === r.bgg_id,
            ) ?? null,
        }));
      return {
        data: this.one ? (rows[0] ?? null) : rows,
        error: null,
        count: rows.length,
      };
    } catch (error) {
      if (this.operation === "select") throw error;
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
  then<TResult1 = Result, TResult2 = never>(
    yes?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    no?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(yes, no);
  }
}
export function createClient() {
  return {
    from: (table: string) => new Query(table),
    auth: {
      getUser: async () => ({
        data: { user: (await session()).user },
        error: null,
      }),
      signOut,
      signInWithOAuth: signIn,
    },
    rpc: async (name: string, args: Row) => {
      if (name !== "record_heartbeat") throw new Error("Unsupported action");
      return action("heartbeat", args, false);
    },
  };
}
