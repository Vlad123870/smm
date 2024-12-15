require('dotenv').config()
import OpenAI from "openai";
import { AppDataSource } from "./data-source"

import Bot from 'node-telegram-bot-api';
import { User } from "./entity/User";
import { Publication } from "./entity/Publication";
import cron from 'node-cron';
import fs from 'fs';
import path from "path";

const bot = new Bot(process.env.TG_TOKEN ?? '', {
    polling: true
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY ?? ''
});
const manager = AppDataSource.manager;
const themes = fs.readFileSync(path.join(process.cwd(), 'themes.txt'));

const publish = async (time: '10' | '12' | '13' | '14') => {
    const publications = await manager.find(Publication, {
        relations: {
            user: true
        },
        where: {
            time: time
        }
    });

    for (const p of publications) {
        try {
            await bot.sendMessage(+p.user.channelId, p.text);
            await bot.sendMessage(+p.user.id, 'Посты опубликованы')
        } catch (error) {
            console.log(error);
            await bot.sendMessage(+p.user.id, 'Не удалось опубликовать пост');
        } finally {
            await manager.delete(Publication, p.id);
        }
    }
}

AppDataSource.initialize().then(async () => {
    bot.onText(/./, async msg => {
        if (!msg.text?.startsWith('/')) {
            const user = await manager.findOneBy(User, {
                id: String(msg.from?.id)
            });
            if (!user) return;
            if (user.waitingForChannel) {
                user.waitingForChannel = false;
                user.channelId = msg.text!;
                await manager.save(user);
                await bot.sendMessage(msg.from!.id, 'Отлично! Теперь можем начать работу. Выбери пункт "Генерация поста" в меню');
            }
            
            if (user.waitingForData) {
                user.waitingForData = false;


                const result = await openai.chat.completions.create({
                    messages: [
                        {
                            role: 'system',
                            content: 'Ты - профессиональный создатель постов. Твоя задача - сгенерировать информативный пост на основе предоставленных данных. Пост должен быть на одну из данных тем. Если нет - не генерируй пост. В ответе дай ТОЛЬКО ПОСТ. Отвечай текстом, не в формате Markdown.'  + '\nТемы:\n' + themes,
                        },
                        {
                            role: 'user',
                            content: msg.text!
                        }
                    ],
                    model: 'gpt-4o-mini'
                });
                user.lastPost = result.choices[0].message.content!;
                await manager.save(user);
                await bot.sendMessage(msg.from!.id, user.lastPost, {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: 'Опубликовать',
                                    callback_data: 'publish'
                                }
                            ],
                            [
                                {
                                    text: 'Отредактировать',
                                    callback_data: 'edit'
                                }
                            ],
                            [
                                {
                                    text: 'Не публиковать',
                                    callback_data: 'do-not-publish'
                                }
                            ]
                        ]
                    }
                })
            } else if (user.waitingForEdit) {
                user.waitingForEdit = false;

                const result = await openai.chat.completions.create({
                    messages: [
                        {
                            role: 'system',
                            content: 'Ты - профессиональный создатель постов. Твоя задача - откорректировать информативный пост на основе предоставленных данных. Учитывай последние тренды в развитии авиации. Твоя задача - сгенерировать информативный пост на основе предоставленных данных. Пост должен быть на одну из данных тем. Если нет - не генерируй пост. В ответе дай ТОЛЬКО ПОСТ. Отвечай текстом, не в формате Markdown. Оригинальный пост: '  + '\nТемы:\n' + themes,
                        },
                        {
                            role: 'user',
                            content: msg.text!
                        }
                    ],
                    model: 'gpt-4o-mini'
                });

                user.lastPost = result.choices[0].message.content!;
                await manager.save(user);

                await bot.sendMessage(msg.from!.id, user.lastPost, {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: 'Опубликовать',
                                    callback_data: 'publish'
                                }
                            ],
                            [
                                {
                                    text: 'Отредактировать',
                                    callback_data: 'edit'
                                }
                            ],
                            [
                                {
                                    text: 'Не публиковать или опубликовать вручную',
                                    callback_data: 'do-not-publish'
                                }
                            ]
                        ]
                    }
                });
            } else if (user.waitingForConcurent) {
                user.waitingForConcurent = false;
                const result = await openai.chat.completions.create({
                    messages: [
                        {
                            role: 'system',
                            content: 'Проанализируй данный тебе пост. Отвечай текстом, НЕ В ФОРМАТЕ Markdown!',
                        },
                        {
                            role: 'user',
                            content: msg.text!
                        }
                    ],
                    model: 'gpt-4o-mini'
                });
                await manager.save(user);
                
                await bot.sendMessage(msg.from!.id, result.choices[0].message.content!);
            }
        } 
    });

    bot.onText(/\/start/, async msg => {
        let user = await manager.findOneBy(User, {
            id: String(msg.from?.id)
        });

        if (!user) {
            user = new User();
            user.id = String(msg.from!.id);
            user.waitingForChannel = true;
            await manager.save(user);
            await bot.sendMessage(msg.from!.id, 'Привет! Я - смм-менеджер. Для начала работы, добавь меня в свой канал и пришли мне ейго ID. ID канала можно узнать у @raw_data_bot'); 
        } else {
            await bot.sendMessage(msg.from!.id, 'Привет! Чем могу помочь?');
        }
    });

    bot.onText(/\/generate/, async msg => {
        const user = await manager.findOneBy(User, {
            id: String(msg.from!.id)
        });
        if (!user) return;

        user.waitingForData = true;
        await manager.save(user);
        await bot.sendMessage(msg.from!.id, 'Пришли мне все данные о посте, и я его сгенерирую.');
    });

    bot.onText(/\/concurent/, async msg => {
        const user = await manager.findOneBy(User, {
            id: String(msg.from!.id)
        });
        if (!user) return;

        user.waitingForConcurent = true;
        await manager.save(user);
        await bot.sendMessage(msg.from!.id, 'Пришли мне пост конкурента, и я его проанализирую.');
    })

    bot.on('callback_query', async q => {
        const user = await manager.findOneBy(User, {
            id: String(q.from.id)
        });
        if (!user) return;
        if (q.data == 'publish') {
            await bot.sendMessage(q.from.id, 'Когда вы хотите опубликовать пост?', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: '10:00 МСК',
                                callback_data: 'pub-10'
                            }
                        ],
                        [
                            {
                                text: '12:00 МСК',
                                callback_data: 'pub-12'
                            }
                        ],
                        [
                            {
                                text: '13:00 МСК',
                                callback_data: 'pub-13'
                            }
                        ],
                        [
                            {
                                text: '14:00 МСК',
                                callback_data: 'pub-14'
                            }
                        ]
                    ]
                }
            });
        } else if (q.data == 'edit') {
            user.waitingForEdit = true;
            await manager.save(user);
            await bot.sendMessage(q.from.id, 'Пришлите мне корректировки');
        } else if (q.data == 'do-not-publish') {
            user.waitingForData = false;
            user.waitingForEdit = false;
            user.lastPost = '';
            await manager.save(user);
            await bot.sendMessage(q.from.id, 'Пост не опубликован.')
        } else if (q.data?.startsWith('pub-')) {
            const time = q.data.substring(3);
            const publication = new Publication();
            publication.text = user.lastPost;
            publication.user = user;
            //@ts-ignore
            publication.time = time;
            user.lastPost = '';
            await manager.save(user);
            await manager.save(publication);
        }
    })
    





    bot.onText(/\/trends/, async msg => {
        const r = (await openai.chat.completions.create({
            messages: [
                {
                    content: 'Какие последние тренды в Авиации? Отвечай текстом, не в формате Markdown.',
                    role: 'user'
                }
            ],
            model: 'gpt-4o-mini'
        })).choices[0].message.content!;
        await bot.sendMessage(msg.from!.id, r);
    });

    bot.setMyCommands([
        {
            command: 'start',
            description: 'Запустить бота'
        },
        {
            command: 'generate',
            description: 'сгенерировать пост'
        },
        {
            command: 'trends',
            description: 'Тренды в сфере Авиации'
        },
        {
            command: 'concurent',
            description: 'Анализ постов конкурентов'
        }
    ])


    cron.schedule('7 * * *', async () => {
        await publish('10');
    });

    cron.schedule('9 * * *', async () => {
        await publish('12');
    });

    cron.schedule('10 * * *', async () => {
        await publish('13');
    });

    cron.schedule('11 * * *', async () => {
        await publish('14');
    });
}).catch(error => console.log(error))
