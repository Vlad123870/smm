import { Entity, PrimaryGeneratedColumn, Column, PrimaryColumn } from "typeorm"

@Entity()
export class User { 

    @PrimaryColumn()
    id: string;
}
