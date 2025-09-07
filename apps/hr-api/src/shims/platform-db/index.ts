// Minimal placeholder exports so imports compile.
// Replace with real implementations later.
export const dataSource: any = {};
export const getDataSource = async (): Promise<any> => dataSource;

// If other files import helper fns from @platform/db, add no-op stubs here:
export const connect = async () => {};
export const query = async (..._args: any[]) => ({ rows: [] });