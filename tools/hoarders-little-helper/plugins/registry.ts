import type { MarketplacePlugin } from './interface';
import { csvPlugin }      from './csv/index';
import { abebooksPlugin } from './abebooks/index';
import { shopifyPlugin }  from './shopify/index';
import { ebayPlugin }     from './ebay/index';
import { etsyPlugin }     from './etsy/index';

export const MARKETPLACE_PLUGINS: MarketplacePlugin[] = [
    csvPlugin,
    abebooksPlugin,
    shopifyPlugin,
    ebayPlugin,
    etsyPlugin,
];

export function getPlugin(id: string): MarketplacePlugin | undefined {
    return MARKETPLACE_PLUGINS.find(p => p.id === id);
}
