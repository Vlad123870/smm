import "reflect-metadata"
import { DataSource } from "typeorm"
import { User } from "./entity/User"
import { Publication } from "./entity/Publication"
import { ConcurentPost } from "./entity/Concurent"

export const AppDataSource = new DataSource({
    type: "postgres",
    host: "db",
    port: 5432,
    username: "test",
    password: "test",
    database: "test",
    synchronize: true,
    logging: true,
    entities: [User, Publication, ConcurentPost],
    migrations: [],
    subscribers: [],
})
