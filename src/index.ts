require('dotenv').config()
import OpenAI from "openai";
import { AppDataSource } from "./data-source"

import Bot from 'node-telegram-bot-api';
import { User } from "./entity/User";
import { Publication } from "./entity/Publication";
import schedule from 'node-schedule';
import fs from 'fs';
import path from "path";
import dayjs from "dayjs";

const bot = new Bot(process.env.TG_TOKEN ?? '', {
    polling: true
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY ?? ''
});
const manager = AppDataSource.manager;
const themes = fs.readFileSync(path.join(process.cwd(), 'themes.txt'));



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
            } else if (user.waitingForTime) {
                if (!/[^[0-9]{2}\:[0-9]{2}$]/.test(msg.text!)) {
                    await bot.sendMessage(msg.from!.id, 'Пoжалуста, укажите время в формате ЧЧ:ММ')
                    return;
                }

                user.waitingForTime = false;
                const pub = new Publication();
                pub.text = user.lastPost;
                pub.user = user;
                user.lastPost = '';
                await manager.save(user);
                await manager.save(pub);
                
                const d = dayjs();
                d.set('day', d.get('day') + 1);
                d.set('hour', +(msg.text?.substring(0, 2)!));
                d.set('minute', +(msg.text?.substring(3, 5)!));
                
                schedule.scheduleJob(d.toDate(), async () => {
                    try {
                        await bot.sendMessage(user.channelId, pub.text);
                        await bot.sendMessage(msg.from!.id, 'Пост опубликован')
                    } catch (error) {
                        console.log(error);
                        await bot.sendMessage(msg.from!.id, 'Пост не опубликован')
                    }
                })
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
            user.waitingForTime = true;
            await manager.save(user)
            await bot.sendMessage(q.from.id, 'Когда вы хотите опубликовать пост? Напишите время в формате ЧЧ:ММ (по GMT)');
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

}).catch(error => console.log(error))
