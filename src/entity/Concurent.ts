import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./User";



@Entity() 
export class ConcurentPost {

    @PrimaryGeneratedColumn()
    id: string;

    @Column()
    text: string;

    @ManyToOne(() => User, (user) => user.concurentPosts)
    user: User;
}