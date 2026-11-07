# Minee's Crafts

A static storefront built with Node.js. Customers can browse the craft catalog, keep a bag, enter delivery details, and prepare an order message in WhatsApp. No payment or order backend is required.

## Run locally

Requires Node.js 18 or newer. From the project folder:

```powershell
npm run dev
```

Open http://localhost:3000. `npm run dev` builds the static site into `dist/` and starts the local preview server. To build without starting the server, run `npm run build`; to serve an existing build, run `npm start`.

## Configure WhatsApp orders

Set the shop's WhatsApp number, including country code and digits only, in `site.config.json`:

```json
{
  "whatsappNumber": "919876543210"
}
```

Alternatively, set `WHATSAPP_NUMBER` in the environment. The environment value overrides the JSON value. When deploying to Vercel, add `WHATSAPP_NUMBER` under Project Settings > Environment Variables and redeploy. Without a configured number, the shop can still be browsed but checkout will not route an order.

The order message includes cart items, quantities, any item customisation notes, subtotal, customer name and phone, delivery address, preferred date, and delivery notes. WhatsApp opens with the message filled in; the customer must tap Send. Delivery charges and payment details are left for the shop to confirm.

## Catalog and images

Edit `data/products.json` to change product names, prices, descriptions, categories, or featured items. Keep product image paths under `items/<category>/`. The build copies only catalog images into `dist/images/`, so original images remain in their folders. New images are detected during build and included as "Price on request" until you add their product details to the catalog.

## Deploy to Vercel

Import this folder as a Vercel project. The included `vercel.json` runs `npm run build` and publishes `dist/`. Configure `WHATSAPP_NUMBER` in the Vercel project settings before enabling orders. No framework preset or third-party package installation is needed.
