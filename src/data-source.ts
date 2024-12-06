import "reflect-metadata"
import { DataSource } from "typeorm"
import { User } from "./entity/User"
import { Publication } from "./entity/Publication"

export const AppDataSource = new DataSource({
    type: "postgres",
    host: "db",
    port: 5432,
    username: "test",
    password: "test",
    database: "test",
    synchronize: true,
    logging: true,
    entities: [User, Publication],
    migrations: [],
    subscribers: [],
})
