import ccxt from "ccxt";
import chalk from "chalk";
import inquirer from "inquirer";
import express from "express";
import * as dotenv from "dotenv";
dotenv.config();

// !IMPORTANT: Set these before running the script in the right format, e.g. "ETH/USD:USD"
const LONG_TICKERS = [
  "ETH/USD:USD",
  "EGLD/USD:USD",
  "BTC/USD:USD",
  "XRP/USD:USD",
  "CHZ/USD:USD",
];

const SHORT_TICKERS = [
  "ETC/USD:USD",
  "LUNC/USD:USD",
  "BTC/USD:USD",
  "ATOM/USD:USD",
];

//FTX related;
let ftx;
let apiKey = "";
let lastTickerPricesLong = [];
let lastTickerPricesShort = [];

console.log("********************************************");
console.log("********************************************");
console.log("********************************************");
console.log(chalk.blue("hi & welcome to the tree script"));
console.log("********************************************");
console.log("********************************************");
console.log("********************************************");
inquirer
  .prompt([
    {
      type: "input",
      name: "apiKey",
      message:
        "Enter you FTX api key (note: this key is only stored in the current process and will get deleted once you end it”)",
      default: process.env.ApiKey,
      filter(value) {
        apiKey = value;
        return value;
      },
    },
    {
      type: "input",
      name: "secretKey",
      message:
        "Enter you FTX secret key (note: this secret is only stored in the current process and will get deleted once you end it”)",
      default: process.env.ApiSecret,
      filter: async (value) => {
        //initiate ftx class
        ftx = new ccxt.ftx({
          apiKey,
          secret: value,
        });

        //fetch the lastest market prices for long basket & set it
        for (let i = 0; i < LONG_TICKERS.length; i++) {
          const ticker = LONG_TICKERS[i];
          const tickerPrice = await ftx.fetchTicker(ticker);
          lastTickerPricesLong.push(tickerPrice.last);
        }

        //fetch the lastest market prices for short basket & set it
        for (let i = 0; i < SHORT_TICKERS.length; i++) {
          const ticker = SHORT_TICKERS[i];
          const tickerPrice = await ftx.fetchTicker(ticker);
          lastTickerPricesShort.push(tickerPrice.last);
        }

        return value;
      },
    },
    {
      type: "input",
      name: "notionalSize",
      message: "Enter your notional size in USD",
      validate(value) {
        const valid = !isNaN(parseFloat(value));
        return valid || "Please enter a number";
      },
      filter: Number,
      default: 1,
    },
    {
      type: "input",
      name: "longMultiplier",
      message:
        "Enter your position multiplier for LONG (e.g. 0.5 => 0.5 * notional_size)",
      validate(value) {
        const valid = !isNaN(parseFloat(value));
        return valid || "Please enter a number";
      },
      filter: Number,
      default: 1,
    },
    {
      type: "input",
      name: "shortMultiplier",
      message:
        "Enter your position multiplier for SHORT (e.g. 1.3 => 1.3 * notional_size)",
      validate(value) {
        const valid = !isNaN(parseFloat(value));
        return valid || "Please enter a number";
      },
      filter: Number,
      default: 1,
    },
    {
      type: "list",
      name: "positionSide",
      message: "Market open position(s) on selected side",
      choices: [
        {
          key: "",
          name: "🔴 SHORT",
          value: "SHORT",
        },
        {
          key: "",
          name: "🟢 LONG",
          value: "LONG",
        },
      ],
      default: false,
    },
  ])
  .then(async (answers) => {
    const { positionSide, longMultiplier, shortMultiplier, notionalSize } =
      answers;
    const notionalUSDvalue =
      notionalSize *
      (positionSide === "SHORT" ? shortMultiplier : longMultiplier);

    //Split notionalUSDvalue between basket of tickers;
    const notionalPerCoinLong = notionalUSDvalue / LONG_TICKERS.length;
    const notionalPerCoinShort = notionalUSDvalue / SHORT_TICKERS.length;

    const positionSizeInTickersLong = [];
    for (let i = 0; i < LONG_TICKERS.length; i++) {
      const ticker = LONG_TICKERS[i];
      if (lastTickerPricesLong[i] <= 0) {
        throw new Error("ticker price can't be 0");
        return;
      }
      let positionSizeForTicker =
        Math.round((notionalPerCoinLong / lastTickerPricesLong[i]) * 100) / 100;
      positionSizeInTickersLong.push(positionSizeForTicker);
    }

    const positionSizeInTickersShort = [];
    for (let i = 0; i < SHORT_TICKERS.length; i++) {
      const ticker = SHORT_TICKERS[i];
      if (lastTickerPricesShort[i] <= 0) {
        throw new Error("ticker price can't be 0");
        return;
      }
      let positionSizeForTicker =
        Math.round((notionalPerCoinShort / lastTickerPricesShort[i]) * 100) /
        100;
      positionSizeInTickersShort.push(positionSizeForTicker);
    }

    if (positionSide === "LONG") {
      //Create market buy orders for each ticker, equal position size
      for (let i = 0; i < LONG_TICKERS.length; i++) {
        try {
          const ticker = LONG_TICKERS[i];
          const positionSizeForTicker = positionSizeInTickersLong[i];
          const order = await ftx.createMarketBuyOrder(
            ticker,
            positionSizeForTicker
          );
          console.log(
            `✅ Successfully posted ${chalk.green(
              positionSide + " $" + ticker
            )}!.Total notional:${chalk.blueBright(
              "$" + Math.round(notionalPerCoinLong)
            )}`
          );
        } catch (error) {
          console.log(chalk.red("Oops, something went wrong: ", error));
        }
      }
    }
    if (positionSide === "SHORT") {
      //Create market sell orders for each ticker, equal position size
      for (let i = 0; i < SHORT_TICKERS.length; i++) {
        try {
          const ticker = SHORT_TICKERS[i];
          const positionSizeForTicker = positionSizeInTickersShort[i];
          const order = await ftx.createMarketSellOrder(
            ticker,
            positionSizeForTicker
          );
          console.log(
            `✅ Successfully posted ${chalk.red(
              positionSide + " $" + ticker
            )}!.Total notional:${chalk.blueBright(
              "$" + Math.round(notionalPerCoinShort)
            )}`
          );
        } catch (error) {
          console.log(chalk.red("Oops, something went wrong: ", error));
        }
      }
    }
  });
