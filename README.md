# BlockLens Explorer

BlockLens Explorer is a Bitcoin relationship explorer built with Next.js, TypeScript, Tailwind CSS, Route Handlers, and `vis-network`.

It accepts either:

- a Bitcoin transaction ID
- a Bitcoin address

and returns:

- a transaction or address summary
- directly related transactions and addresses
- an interactive graph of on-chain relationships
- controlled hop-by-hop expansion with node and depth guardrails

BlockLens only shows on-chain relationships. It does not claim ownership, clustering, or entity attribution.

## Stack

- Next.js 16 with App Router
- TypeScript
- Tailwind CSS 4
- Next Route Handlers as a backend-for-frontend proxy
- `vis-network` for graph rendering
- No database required

## Features

- Search for a txid or Bitcoin address with basic client-side format detection
- Transaction mode with inputs, outputs, outspends, and spending transaction links
- Address mode with summary stats, recent transactions, and neighboring addresses
- Graph zoom, pan, drag, selection, and node expansion
- Details panel with copy actions and external explorer links
- Shareable search URLs via `/?q=<value>`
- In-memory session caching for repeated lookups during a session
- Public API fallback from mempool.space to Blockstream Esplora
- Rate-limit, truncation, and heuristic warnings in the UI

## Project structure

```text
app/
  page.tsx
  api/
    search/route.ts
    tx/[txid]/route.ts
    address/[address]/route.ts
    expand/route.ts
components/
  ExplorerApp.tsx
  SearchBar.tsx
  FiltersPanel.tsx
  SummaryCards.tsx
  GraphView.tsx
  DetailsPanel.tsx
lib/
  blockchain/
    http.ts
    provider.ts
    mempool.ts
    esplora.ts
  graph/
    normalize.ts
    buildGraph.ts
    expandGraph.ts
    viewGraph.ts
  utils/
    validateBitcoinInput.ts
    format.ts
types/
  blockchain.ts
  graph.ts
```

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create local env config:

   ```bash
   cp .env.example .env.local
   ```

3. Start development:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Environment variables

See [.env.example](/Users/su1/Github/Personal/BlockLens/.env.example).

```bash
BLOCKLENS_MEMPOOL_BASE_URL=https://mempool.space/api
BLOCKLENS_ESPLORA_BASE_URL=https://blockstream.info/api
BLOCKLENS_FETCH_TIMEOUT_MS=10000
BLOCKLENS_FETCH_RETRIES=2
BLOCKLENS_REVALIDATE_SECONDS=30
```

Notes:

- Defaults point to Bitcoin mainnet public APIs.
- To target a self-hosted backend later, swap `BLOCKLENS_MEMPOOL_BASE_URL` and/or `BLOCKLENS_ESPLORA_BASE_URL`.
- The provider seam for that change is in [lib/blockchain/mempool.ts](/Users/su1/Github/Personal/BlockLens/lib/blockchain/mempool.ts) and [lib/blockchain/esplora.ts](/Users/su1/Github/Personal/BlockLens/lib/blockchain/esplora.ts).

## Provider layer

The app prefers mempool.space first and falls back to Blockstream Esplora when mempool fails or rate-limits.

Key provider methods:

- `getTransaction(txid)`
- `getTransactionOutspends(txid)`
- `getAddress(address)`
- `getAddressTransactions(address)`
- `getSpendingTransaction(txid, vout)`
- `searchEntity(input)`

The shared provider entry point is [lib/blockchain/provider.ts](/Users/su1/Github/Personal/BlockLens/lib/blockchain/provider.ts).

## Graph model

Normalized graph data is shaped as:

```ts
nodes: { id, type, label, raw, metadata }
edges: { id, from, to, type, value, metadata }
```

Node types:

- `transaction`
- `address`

Edge types:

- `input`
- `output`
- `spent_by`
- `received_by`

Important semantics:

- Input-side address links are labeled as heuristic because they come from prevout script data, not ownership proof.
- Output and outspend relationships are explicit on-chain links.
- Expansion never runs recursively on its own.

## Search and expansion behavior

- Default graph depth: 1 hop
- Maximum manual expansion depth: 20 hops
- Maximum node count: 200
- Duplicate nodes and edges are deduplicated before rendering
- Already-expanded nodes are tracked so traversal does not loop back endlessly

The expansion logic lives in [lib/graph/expandGraph.ts](/Users/su1/Github/Personal/BlockLens/lib/graph/expandGraph.ts).

## Deployment

This app is configured for Cloudflare Workers using OpenNext.

Recommended production hostname:

- `lens.suwansankaja.com`

Other good options:

- `blocklens.suwansankaja.com`
- `btc.suwansankaja.com`
- `explorer.suwansankaja.com`

Recommended Cloudflare flow:

1. Push the repo to GitHub
2. In Cloudflare, go to `Workers & Pages`
3. Create a new Worker from Git
4. Select this repository
5. Set the Worker name to `blocklens-explorer` so it matches [wrangler.jsonc](/Users/su1/Github/Personal/BlockLens/wrangler.jsonc)
6. Use these build settings:
   - Install command: `npm install`
   - Build command: `npm run cf:build`
   - Deploy command: `npx wrangler deploy`
7. Set the production branch to `dev` if you want `dev` pushes to deploy to the live subdomain immediately
8. Add the env vars from [.env.example](/Users/su1/Github/Personal/BlockLens/.env.example)
9. Deploy
10. In the Worker dashboard, add a Custom Domain such as `lens.suwansankaja.com`

Because it uses:

- no database
- no auth
- no paid APIs

the operational footprint stays small.

### Local Cloudflare preview

To test the Worker build locally before deploying:

```bash
npm run preview
```

To generate Cloudflare environment typings:

```bash
npm run cf-typegen
```

### GitHub to Cloudflare auto-deploy

The simplest CI/CD setup is Cloudflare Workers Builds:

- Connect the GitHub repository once in Cloudflare
- Choose `dev` as the production branch if that is your active deployment branch
- Every push to `dev` triggers a new Cloudflare build and deployment automatically
- If you later want `main` for production and `dev` for a staging subdomain, create a second Worker and point it at the same repo with `dev` as its production branch

This repo already includes the files Cloudflare expects:

- [wrangler.jsonc](/Users/su1/Github/Personal/BlockLens/wrangler.jsonc)
- [open-next.config.ts](/Users/su1/Github/Personal/BlockLens/open-next.config.ts)

### Notes for custom domains

- The Worker name and the deployed Worker project should stay aligned with [wrangler.jsonc](/Users/su1/Github/Personal/BlockLens/wrangler.jsonc)
- Custom domains are easiest to attach from the Cloudflare dashboard after the first successful deployment
- Because `suwansankaja.com` is already on Cloudflare, adding `lens.suwansankaja.com` is typically a direct dashboard step with no extra nameserver work

## Swapping in a self-hosted backend later

The easiest upgrade path is to point the existing provider base URLs at your own Esplora-compatible infrastructure.

Places designed for that swap:

- [lib/blockchain/mempool.ts](/Users/su1/Github/Personal/BlockLens/lib/blockchain/mempool.ts)
- [lib/blockchain/esplora.ts](/Users/su1/Github/Personal/BlockLens/lib/blockchain/esplora.ts)
- [lib/blockchain/http.ts](/Users/su1/Github/Personal/BlockLens/lib/blockchain/http.ts)

If you later add a database or clustering layer, the cleanest place to branch is behind the route handlers:

- [app/api/search/route.ts](/Users/su1/Github/Personal/BlockLens/app/api/search/route.ts)
- [app/api/expand/route.ts](/Users/su1/Github/Personal/BlockLens/app/api/expand/route.ts)

That keeps third-party URLs hidden from the client and avoids reworking the frontend graph components.

## Known limitations of public API approach

- Public explorer APIs can rate-limit or temporarily fail, especially during traffic spikes.
- Address transaction history from public endpoints is bounded and may require paging for deeper history. The initial address graph stays intentionally lightweight.
- Graph completeness depends on what the public endpoint returns for the specific transaction or address.
- This app does not do wallet clustering, entity attribution, or off-chain enrichment.
- Input-side address relationships are heuristic and can be misleading if interpreted as ownership.
- Default endpoints are mainnet-oriented. Testnet/signet support would require swapping the base URLs.
- Very large hub addresses or fan-out transactions are intentionally truncated to protect UI performance and public API usage.

## API references used

- [mempool.space REST API docs](https://mempool.space/docs/api/rest)
- [Blockstream Esplora API docs](https://github.com/Blockstream/esplora/blob/master/API.md)
