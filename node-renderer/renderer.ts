import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import express from 'express';
import type { Request, Response } from 'express';
import React from 'react';
import ReactDOMServer from 'react-dom/server';

import { pages, layouts } from './importMap.generated.js';

const app = express();
const port = process.env.NODE_PORT ? parseInt(process.env.NODE_PORT, 10) : 3001;

// Serve the client bundle for hydration
app.use(express.static(path.join(__dirname, 'dist')));

app.use(express.json());

interface RenderRequest {
    componentPath: string;
    layoutPath?: string;
    props: { [key: string]: any };
}

app.post('/render', async (req: Request, res: Response) => {
    const { componentPath, layoutPath, props } = req.body as RenderRequest;

    if (!componentPath) {
        return res.status(400).json({ error: 'componentPath is required' });
    }

    try {
        // Use import map for dynamic imports
        const PageModule = await pages[componentPath]();
        const Page = PageModule.default || PageModule;
        const pageMetadata = PageModule.metadata || {};

        if (typeof Page !== 'function') {
            throw new Error(`Failed to load component from ${componentPath}. Make sure it has a default export.`);
        }

        let element: React.ReactElement;
        let layoutMetadata = {};
        if (layoutPath && layouts[layoutPath]) {
            const LayoutModule = await layouts[layoutPath]!();
            const Layout = LayoutModule.default || LayoutModule;
            layoutMetadata = LayoutModule.metadata || {};
            if (typeof Layout !== 'function') {
                throw new Error(`Failed to load layout from ${layoutPath}. Make sure it has a default export.`);
            }
            element = React.createElement(Layout, props, React.createElement(Page, props));
        } else {
            element = React.createElement(Page, props);
        }

        // Merge metadata: layout takes precedence over page
        const metadata = { ...pageMetadata, ...layoutMetadata };

        const html = ReactDOMServer.renderToString(element);
        res.json({ html, metadata });
    } catch (error: any) {
        console.error('Error rendering component:', error);
        res.status(500).json({ error: 'Failed to render component', details: error.message });
    }
});

app.listen(port, () => {
    console.log(`Node.js renderer listening on http://localhost:${port}`);
}); 