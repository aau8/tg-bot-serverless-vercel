import { VercelRequest, VercelResponse } from "@vercel/node";
import { Telegraf, Context as _, Scenes, session } from "telegraf";
import { about, greeting } from "..";
import { ok } from "./responses";
import { Mongo } from "@telegraf/session/mongodb";

const debug = require("debug")("lib:telegram");
const isDev = process.env.DEV;
const VERCEL_URL = process.env.VERCEL_URL;
const BOT_TOKEN = process.env.BOT_TOKEN;
export const bot = new Telegraf(BOT_TOKEN, { telegram: { webhookReply: false } });

function botUtils() {
	bot.use(Telegraf.log());
	// @ts-ignore
	const store = Mongo({
		url: 'mongodb+srv://villagio_fs82ds:81JQsclrc1rT0bvU@atlascluster.ysvbgmt.mongodb.net/?retryWrites=true&w=majority',
		database: 'test',
		collection: 'messages',
	})

	// interface Answers {
	// 	name: string,
	// 	age: string,
	// 	phone: string,
	// }

	// @ts-ignore
	bot.use(session())
	// bot.use(session({ store, defaultSession: () => ({ answers: <Answers>{} }) }))

	// bot.use(logger);

	// const answers = <Answers> {}
	const testScene = new Scenes.WizardScene(
		'wiz',
		async ctx => {
			// @ts-ignore
			// console.log('ctx.session', ctx.scene.)
			// console.log('ctx.session', ctx.session)
			await ctx.reply('Как вас зовут?')
			return ctx.wizard.next()
		},
		async ctx => {
			// @ts-ignore
			ctx.scene.state.name = ctx.message.text

			await ctx.reply('Сколько вам лет?')
			return ctx.wizard.next()
		},
		async ctx => {
			// @ts-ignore
			ctx.scene.state.age = ctx.message.text
			await ctx.reply('Оставьте ваш номер телефона')
			return ctx.wizard.next()
		},
		async ctx => {
			// @ts-ignore
			ctx.scene.state.phone = ctx.message.text
			// @ts-ignore
			await ctx.reply(`Имя: ${ctx.scene.state.name}\nВозраст: ${ctx.scene.state.age}\nНомер: ${ctx.scene.state.phone}`)
			return await ctx.scene.leave()
		}
	)

	// @ts-ignore
	const stage = new Scenes.Stage([ testScene ])
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

		bot.webhookReply = false;

		const botInfo = await bot.telegram.getMe();

		console.info("Server has initialized bot username: ", botInfo.username);

		debug(`deleting webhook`);
		await bot.telegram.deleteWebhook();
		res(true)
	})
}

export async function useWebhook(req: VercelRequest, res: VercelResponse) {
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

// export const logger = async (_: TelegrafContext, next): Promise<void> => {
// 	const start = new Date();
// 	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// 	// @ts-ignore
// 	await next();
// 	const ms = new Date().getTime() - start.getTime();
// 	console.log("Response time: %sms", ms);
// };

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
