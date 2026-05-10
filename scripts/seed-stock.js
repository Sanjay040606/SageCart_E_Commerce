async function main() {
  const { main: seedStock } = await import("./seed-stock.mjs");
  await seedStock();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
