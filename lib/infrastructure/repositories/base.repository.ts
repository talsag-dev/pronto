import { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import type { Database } from "@/lib/shared/types";
import { NotFoundError, DatabaseError, logger } from "@/lib/shared/utils";

type TableName = keyof Database["public"]["Tables"];

export abstract class BaseRepository<T extends TableName> {
  constructor(
    protected readonly client: SupabaseClient<Database>,
    protected readonly tableName: T
  ) {}

  /**
   * Find a single record by ID
   */
  protected async findById(id: string, select = "*") {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select(select)
        // @ts-expect-error - Supabase cannot infer types with generic table names
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null;
        }
        throw this.handleError(error, "findById");
      }

      return data;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }
      throw this.handleError(error, "findById");
    }
  }

  /**
   * Find all records matching criteria
   */
  protected async findMany(
    filters: Record<string, unknown> = {},
    select = "*",
    options: {
      orderBy?: { column: string; ascending?: boolean };
      limit?: number;
      offset?: number;
    } = {}
  ) {
    try {
      const query = this.client.from(this.tableName);
      let selectQuery = query.select(select);

      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        // @ts-expect-error - Supabase cannot infer types with generic table names
        selectQuery = selectQuery.eq(key, value);
      });

      // Apply ordering
      if (options.orderBy) {
        selectQuery = selectQuery.order(options.orderBy.column, {
          ascending: options.orderBy.ascending ?? true,
        });
      }

      // Apply pagination
      if (options.limit) {
        selectQuery = selectQuery.limit(options.limit);
      }
      if (options.offset) {
        selectQuery = selectQuery.range(
          options.offset,
          options.offset + (options.limit || 10) - 1
        );
      }

      const { data, error } = await selectQuery;

      if (error) {
        throw this.handleError(error, "findMany");
      }

      return data || [];
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw this.handleError(error, "findMany");
    }
  }

  /**
   * Create a new record
   */
  protected async create(data: Database["public"]["Tables"][T]["Insert"]) {
    try {
      const query = this.client.from(this.tableName);
      const { data: created, error } = await query
        // @ts-expect-error - Supabase cannot infer types with generic table names
        .insert(data)
        .select()
        .single();

      if (error) {
        throw this.handleError(error, "create");
      }

      logger.info(`Created ${this.tableName} record`, {
        id: created,
      });
      return created;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw this.handleError(error, "create");
    }
  }

  /**
   * Update an existing record
   */
  protected async update(
    id: string,
    data: Database["public"]["Tables"][T]["Update"]
  ) {
    try {
      const query = this.client.from(this.tableName);
      const { data: updated, error } = await query
        // @ts-expect-error - Supabase cannot infer types with generic table names
        .update(data)
        // @ts-expect-error - Supabase cannot infer types with generic table names
        .eq("id", id)
        .select()
        .single();

      if (error) {
        throw this.handleError(error, "update");
      }

      logger.info(`Updated ${this.tableName} record`, { id });
      return updated;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }
      throw this.handleError(error, "update");
    }
  }

  /**
   * Delete a record by ID
   */
  protected async delete(id: string) {
    try {
      const query = this.client.from(this.tableName);
      // @ts-expect-error - Supabase cannot infer types with generic table names
      const { error } = await query.delete().eq("id", id);

      if (error) {
        throw this.handleError(error, "delete");
      }

      logger.info(`Deleted ${this.tableName} record`, { id });
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw this.handleError(error, "delete");
    }
  }

  /**
   * Count records matching criteria
   */
  protected async count(filters: Record<string, unknown> = {}) {
    try {
      const query = this.client.from(this.tableName);
      let countQuery = query.select("*", {
        count: "exact",
        head: true,
      });

      Object.entries(filters).forEach(([key, value]) => {
        // @ts-expect-error - Supabase cannot infer types with generic table names
        countQuery = countQuery.eq(key, value);
      });

      const { count, error } = await countQuery;

      if (error) {
        throw this.handleError(error, "count");
      }

      return count || 0;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw this.handleError(error, "count");
    }
  }

  /**
   * Handle Postgres errors and convert to app errors
   */
  protected handleError(error: unknown, operation: string) {
    if (error instanceof PostgrestError) {
      logger.error(`Database error in ${this.tableName}.${operation}`, error, {
        code: error.code,
        details: error.details,
        hint: error.hint,
      });

      return new DatabaseError(
        `Failed to ${operation} ${this.tableName}: ${error.message}`,
        {
          code: error.code,
          details: error.details,
          hint: error.hint,
        }
      );
    }

    if (error instanceof Error) {
      logger.error(`Error in ${this.tableName}.${operation}`, error);
      return new DatabaseError(
        `Failed to ${operation} ${this.tableName}: ${error.message}`
      );
    }

    logger.error(`Unknown error in ${this.tableName}.${operation}`, error);
    return new DatabaseError(`Failed to ${operation} ${this.tableName}`);
  }
}
