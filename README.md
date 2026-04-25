<<<<<<< HEAD
# SageCart

SageCart is a calmer e-commerce storefront built with Next.js, Clerk, MongoDB, and Inngest. It includes product browsing, cart and order flows, seller tools, return and refund handling, and transactional email support.

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

Open [http://localhost:3000](http://localhost:3000) in your browser to see the app.

## Email Setup

To enable contact, welcome, order, delivery, and refund emails, add these SMTP variables to your `.env` file:

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM=
CONTACT_RECEIVER_EMAIL=sagecart.support@gmail.com
```

Contact form emails are sent to `sagecart.support@gmail.com`, with the customer email used as the reply address.

## Features

- SageCart branding and a subtle sage-toned UI
- Clerk authentication
- Product browsing and cart
- Order timeline, delivery, return, and refund tracking
- Contact form mail delivery
- Welcome, order confirmation, delivery, and refund emails
- Seller dashboard and seller order views

## Deploy on Vercel

The easiest way to deploy the app is with the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

For more details, see the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying).
=======
# SageCart_E_Commerce
SageCart is a modern, full-stack e-commerce platform built with Next.js. It features seller dashboards for product management, user cart and order processing, payment integration and a responsive UI with Tailwind CSS. Includes API routes for CRUD operations, authentication, and inventory tracking. Perfect for small to medium online stores. 
>>>>>>> ffed8cf054ce36d0792180dcb3f0136840c4d5b6
