declare module 'sql.js' {
  export interface SqlJsQueryResult {
    columns: string[];
    values: any[][];
  }

  export interface SqlJsDatabase {
    close(): void;
    run(sql: string, params?: any[]): SqlJsDatabase;
    exec(sql: string): SqlJsQueryResult[];
    export(): Uint8Array;
  }

  export interface InitSqlJsConfig {
    locateFile?: (file: string) => string;
  }

  export interface SqlJsStatic {
    Database: new (data?: Uint8Array) => SqlJsDatabase;
  }

  export default function initSqlJs(config?: InitSqlJsConfig): Promise<SqlJsStatic>;
}

