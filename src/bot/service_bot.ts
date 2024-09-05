import {Bot} from "grammy";

export class ServiceBot {
    private bot: Bot;
    private readonly chatId: number;

    constructor(token: string, chatId: number) {
        this.chatId = chatId;
        this.bot = new Bot(token);
    }

    async sendMessage(message: string): Promise<void> {
        try {
            await this.bot.api.sendMessage(this.chatId, message);
        } catch (e) {
            console.error("FAILED TO SEND CHAT MESSAGE: ", e);
        }
    }
}
