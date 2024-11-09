require('dotenv').config()
import { AppDataSource } from "./data-source"

AppDataSource.initialize().then(async () => {

    console.log("Hello world!");

}).catch(error => console.log(error))
