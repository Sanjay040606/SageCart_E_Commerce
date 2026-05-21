async function main() {
  const { main: migrateSellerImages } = await import("./migrate-seller-images.mjs");
  await migrateSellerImages();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
