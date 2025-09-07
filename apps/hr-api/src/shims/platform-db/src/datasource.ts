// Minimal placeholder exports so imports compile. Replace later.
export const dataSource: any = {};
export const AppDataSource: any = dataSource;   // <— needed by your imports
export const getDataSource = async (): Promise<any> => dataSource;