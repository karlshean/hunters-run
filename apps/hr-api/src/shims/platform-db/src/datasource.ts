// Matches imports like: import { dataSource } from '@platform/db/src/datasource';
export const dataSource: any = {};
export const getDataSource = async (): Promise<any> => dataSource;