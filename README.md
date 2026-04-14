## SageCart

SageCart is a calmer e-commerce storefront built with Next.js, Clerk, MongoDB, and Inngest. It includes order tracking, return and refund flows, seller tools, and transactional email support.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Email Setup

To enable contact, welcome, order, delivery, and refund emails, add these SMTP variables to your `.env`:

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM=
CONTACT_RECEIVER_EMAIL=sagecart.support@gmail.com
```

Contact form emails are sent to `sagecart.support@gmail.com`, with the customer email set as the reply address.

## Features

- SageCart branding and subtle sage-toned UI
- Clerk authentication
- Product browsing and cart
- Order timeline, delivery, return, and refund tracking
- Contact form mail delivery
- Welcome, order confirmation, delivery, and refund emails
- Seller dashboard and seller order views

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
