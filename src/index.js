import ccxt from "ccxt";
import chalk from "chalk";
import inquirer from "inquirer";

// !IMPORTANT: Set these before running the script in the right format, e.g. "ETH/USD:USD"
const TICKERS = [
  "ETH/USD:USD",
  "EGLD/USD:USD",
  "BTC/USD:USD",
  "XRP/USD:USD",
  "CHZ/USD:USD",
];

//FTX related;
let ftx;
let apiKey = "";
let lastTickerPrices = [];

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
      default: "",
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
      default: "",
      filter: async (value) => {
        //initiate ftx class
        ftx = new ccxt.ftx({
          apiKey,
          secret: value,
        });

        //fetch the lastest market prices & set it
        for (let i = 0; i < TICKERS.length; i++) {
          const ticker = TICKERS[i];
          const tickerPrice = await ftx.fetchTicker(ticker);
          lastTickerPrices.push(tickerPrice.last);
        }
        console.log(lastTickerPrices);

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
      message: "Choose your side and confirm to open position",
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
    const notionalPerCoin = notionalUSDvalue / TICKERS.length;

    const positionSizeInTickers = [];
    for (let i = 0; i < TICKERS.length; i++) {
      const ticker = TICKERS[i];
      if (lastTickerPrices[i] <= 0) {
        throw new Error("ticker price can't be 0");
        return;
      }
      let positionSizeForTicker =
        Math.round((notionalPerCoin / lastTickerPrices[i]) * 100) / 100;
      positionSizeInTickers.push(positionSizeForTicker);
    }

    if (positionSide === "LONG") {
      //Create market buy orders for each ticker, equal position size
      for (let i = 0; i < TICKERS.length; i++) {
        try {
          const ticker = TICKERS[i];
          const positionSizeForTicker = positionSizeInTickers[i];
          const order = await ftx.createMarketBuyOrder(
            ticker,
            positionSizeForTicker
          );
          console.log(
            `✅ Successfully posted ${chalk.green(
              positionSide + " $" + ticker
            )}!.Total notional:${chalk.blueBright(
              "$" + Math.round(notionalPerCoin)
            )}`
          );
        } catch (error) {
          console.log(chalk.red("Oops, something went wrong: ", error));
        }
      }
    }
    if (positionSide === "SHORT") {
      //Create market sell orders for each ticker, equal position size
      for (let i = 0; i < TICKERS.length; i++) {
        try {
          const ticker = TICKERS[i];
          const positionSizeForTicker = positionSizeInTickers[i];
          const order = await ftx.createMarketSellOrder(
            ticker,
            positionSizeForTicker
          );
          console.log(
            `✅ Successfully posted ${chalk.red(
              positionSide + " $" + ticker
            )}!.Total notional:${chalk.blueBright(
              "$" + Math.round(notionalPerCoin)
            )}`
          );
        } catch (error) {
          console.log(chalk.red("Oops, something went wrong: ", error));
        }
      }
    }
  });
