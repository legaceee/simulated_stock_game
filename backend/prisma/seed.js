import fs from "fs";
import path from "path";
import prisma from "../config/prismaClient.js";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

async function main() {
  console.log(" Seeding stocks (upsert)...");

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const stocksData = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../stocks.json"), "utf-8")
  );

  for (const stock of stocksData) {
    await prisma.stock.upsert({
      where: { symbol: stock.symbol }, //  match by unique symbol
      update: {
        companyName: stock.companyName,
        currentPrice: stock.currentPrice,
        exchange: stock.exchange,
        sector: stock.sector,
        totalQuantity: BigInt(stock.totalQuantity),
        marketCap: stock.marketCap,
      },
      create: {
        id: stock.id, // still insert the ID when creating
        symbol: stock.symbol,
        companyName: stock.companyName,
        currentPrice: stock.currentPrice,
        exchange: stock.exchange,
        sector: stock.sector,
        totalQuantity: BigInt(stock.totalQuantity),
        marketCap: stock.marketCap,
      },
    });
  }
  console.log(" Stock upsert completed!");

  // Seeding Mutual Funds
  console.log(" Seeding mutual funds (upsert)...");
  const funds = [
    { symbol: "SBIBLUE", name: "SBI Bluechip Fund Direct Growth", nav: 85.50, category: "EQUITY", returns3y: 18.2 },
    { symbol: "HDFCSMALL", name: "HDFC Small Cap Fund Direct Growth", nav: 120.40, category: "EQUITY", returns3y: 28.6 },
    { symbol: "ICICIPRUDENT", name: "ICICI Prudential Debt & Gold EV Fund", nav: 42.10, category: "HYBRID", returns3y: 12.4 },
    { symbol: "NIPPONLIQUID", name: "Nippon India Liquid Fund Direct Growth", nav: 3500.50, category: "DEBT", returns3y: 6.8 },
    { symbol: "PARAGPARIKH", name: "Parag Parikh Flexi Cap Fund Direct Growth", nav: 72.80, category: "EQUITY", returns3y: 22.1 },
    { symbol: "AXISELSS", name: "Axis ELSS Tax Saver Fund Direct Growth", nav: 95.30, category: "ELSS", returns3y: 15.5 },
  ];

  for (const fund of funds) {
    await prisma.mutualFund.upsert({
      where: { symbol: fund.symbol },
      update: {
        name: fund.name,
        nav: fund.nav,
        category: fund.category,
        returns3y: fund.returns3y,
      },
      create: fund,
    });
  }
  console.log(" Mutual funds upsert completed!");

  // Seeding Commodities
  console.log(" Seeding commodities (upsert)...");
  const commodities = [
    { symbol: "GOLD", name: "Gold (999 Purity)", currentPrice: 72500.00, unit: "per 10g" },
    { symbol: "SILVER", name: "Silver (999 Purity)", currentPrice: 88400.00, unit: "per 1kg" },
    { symbol: "CRUDE_OIL", name: "Crude Oil WTI", currentPrice: 6850.00, unit: "per barrel" },
    { symbol: "COPPER", name: "Copper", currentPrice: 785.00, unit: "per 1kg" },
  ];

  for (const comm of commodities) {
    await prisma.commodity.upsert({
      where: { symbol: comm.symbol },
      update: {
        name: comm.name,
        currentPrice: comm.currentPrice,
        unit: comm.unit,
      },
      create: comm,
    });
  }
  console.log(" Commodities upsert completed!");
}

main()
  .catch((e) => {
    console.error(" Error seeding stocks:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
