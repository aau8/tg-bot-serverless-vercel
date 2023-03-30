import { NowRequest, NowResponse } from "@vercel/node";
import { Telegraf, Context as TelegrafContext, Scenes, session } from "telegraf";
// import { ExtraReplyMessage } from "telegraf/typings/telegram-types";
import { about, greeting } from "..";
import { ok } from "./responses";

const debug = require("debug")("lib:telegram");
const isDev = process.env.DEV;
const VERCEL_URL = process.env.VERCEL_URL;
const BOT_TOKEN = process.env.BOT_TOKEN;
export const bot = new Telegraf(BOT_TOKEN);

function botUtils() {
	bot.use(Telegraf.log());
	bot.use(logger);
	console.log('botUtils')

	interface Answers {
		name: string,
		age: string,
		phone: string,
	}

	const answers = <Answers> {}
	const testScene = new Scenes.WizardScene(
		'wiz',
		async ctx => {
			await ctx.reply('Как вас зовут?')
			return ctx.wizard.next()
		},
		async ctx => {
			// @ts-ignore
			answers.name = ctx.message.text

			await ctx.reply('Сколько вам лет?')
			return ctx.wizard.next()
		},
		async ctx => {
			// @ts-ignore
			answers.age = ctx.message.text
			await ctx.reply('Оставьте ваш номер телефона')
			return ctx.wizard.next()
		},
		async ctx => {
			// @ts-ignore
			answers.phone = ctx.message.text
			await ctx.reply(`Имя: ${answers.name}\nВозраст: ${answers.age}\nНомер: ${answers.phone}`)
			return await ctx.scene.leave()
		}
	)

	// @ts-ignore
	const stage = new Scenes.Stage([ testScene ])

	// const scene = new Scenes.BaseScene<Scenes.SceneContext>('base')

	// scene.enter(ctx => {
	// 	ctx.reply('First screen')
	// })

	// const stage = new Scenes.Stage<Scenes.SceneContext>([ scene ], {
	// 	default: 'base'
	// })
	bot.use(session())
	bot.use(stage.middleware())


	bot.command('scene', ctx => {
		// @ts-ignore
		ctx.scene.enter('wiz')
	})

	bot.start(ctx => {
		console.log('start')
		return ctx.reply("This is a test bot.");
	});

	bot.command("about", about()).on("text", greeting());
}

async function localBot() {
	return new Promise(async (res) => {
		debug("Bot is running in development mode at http://localhost:3000");
		console.log('localBot 1')

		bot.webhookReply = false;

		const botInfo = await bot.telegram.getMe();
		// bot.options.username = botInfo.username;

		console.info("Server has initialized bot username: ", botInfo.username);


		console.log('localBot 2')

		debug(`deleting webhook`);
		await bot.telegram.deleteWebhook();

		console.log('localBot 3')
		// debug(`starting polling`);
		// await bot.launch().then(res => console.log('res', res))
		// console.log('localBot')
		res(true)
	})
}

export async function useWebhook(req: NowRequest, res: NowResponse) {
	try {
		if (!isDev && !VERCEL_URL) {
			throw new Error("VERCEL_URL is not set.");
		}

		const getWebhookInfo = await bot.telegram.getWebhookInfo();

		const botInfo = await bot.telegram.getMe();
		// bot.options.username = botInfo.username;
		console.info("Server has initialized bot username using Webhook. ", botInfo.username);

		if (getWebhookInfo.url !== VERCEL_URL + "/api") {
			debug(`deleting webhook`);
			await bot.telegram.deleteWebhook();
			debug(`setting webhook to ${VERCEL_URL}/api`);
			await bot.telegram.setWebhook(`${VERCEL_URL}/api`);
		}

		// call bot commands and middlware
		botUtils();

		// console.log("webhook already defined");
		// console.log("request method: ", req.method);
		// console.log("req.body", req.body);

		if (req.method === "POST") {
			await bot.handleUpdate(req.body, res);
		} else {
			ok(res, "Listening to bot events...");
		}
	} catch (error) {
		console.error(error);
		return error.message;
	}
}

// export function toArgs(ctx: TelegrafContext) {
// 	const regex = /^\/([^@\s]+)@?(?:(\S+)|)\s?([\s\S]+)?$/i;
// 	const parts = regex.exec(ctx.message!.text!.trim());
// 	if (!parts) {
// 		return [];
// 	}
// 	return !parts[3] ? [] : parts[3].split(/\s+/).filter(arg => arg.length);
// }

// export const MARKDOWN = Extra.markdown(true) as ExtraReplyMessage;

// export const NO_PREVIEW = Extra.markdown(true).webPreview(false) as ExtraReplyMessage;

export const hiddenCharacter = "\u200b";

export const logger = async (_: TelegrafContext, next): Promise<void> => {
	const start = new Date();
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	await next();
	const ms = new Date().getTime() - start.getTime();
	console.log("Response time: %sms", ms);
};

if (isDev) {
	console.log("isDev", isDev);

	localBot().then(() => {
		// call bot commands and middlware
		botUtils();
		console.log('localBot end')

		// launch bot
		bot.launch();
	});
}
