import "reflect-metadata";
import { DataSource } from "typeorm";
export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  ssl: false,
  entities: [],
  migrations: [],
  synchronize: false,
  logging: ["error","warn"]
});