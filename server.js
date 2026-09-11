import { handler } from './build/handler.js';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });
const target = process.env.HASS_URL;
if (!target) throw new Error('HASS_URL is required');
const port = Number(process.env.PORT || 5050);
const app = express();
app.use(
	createProxyMiddleware({
		pathFilter: ['/local/', '/api/'],
		target,
		changeOrigin: true
	})
);
app.use(handler);
app.listen(port, () => console.log(`Hearth listening on port ${port}`));
