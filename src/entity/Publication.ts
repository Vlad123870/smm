import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./User";


@Entity()
export class Publication {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    text: string;

    @Column()
    time: '10' | '12' | '13' | '14';

    @ManyToOne(() => User, (user) => user.publications)
    user: User;
    
}