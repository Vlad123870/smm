import { Entity, PrimaryGeneratedColumn, Column, PrimaryColumn, OneToMany } from "typeorm"
import { Publication } from "./Publication";
import { ConcurentPost } from "./Concurent";

@Entity()
export class User { 

    @PrimaryColumn()
    id: string;

    @Column({
        nullable: true
    })
    threadId: string;

    @Column({
        nullable: true,
    })
    channelId: string;

    @Column({
        default: false
    })
    waitingForChannel: boolean;

    @Column({
        default: false
    })
    waitingForData: boolean;

    @Column({
        default: false
    })
    waitingForEdit: boolean;

    @Column({
        default: false
    })
    waitingForConcurent: boolean;

    @Column({
        default: false
    })
    waitingForTime: boolean;

    @Column({
        default: ''
    })
    lastPost: string;



    @OneToMany(() => Publication, (publication) => publication.user)
    publications: Publication[];

    @OneToMany(() => ConcurentPost, (p) => p.user)
    concurentPosts: ConcurentPost[];
    
}
