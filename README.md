<p align="center">
  <img src="public/logo.png" alt="BlockLens" width="100" height="100" style="border-radius: 20px;" />
</p>

<h1 align="center">BlockLens Explorer</h1>

<p align="center">
  <strong>A beautiful, interactive Bitcoin relationship explorer</strong>
</p>

<p align="center">
  <a href="https://blocklens.suwansankaja.com"><img src="https://img.shields.io/badge/🌐_Live_Demo-blocklens.suwansankaja.com-38bdf8?style=for-the-badge" alt="Live Demo" /></a>
</p>

<p align="center">
  <a href="#-features"><img src="https://img.shields.io/badge/Bitcoin-Mainnet-orange?style=flat-square&logo=bitcoin" alt="Bitcoin Mainnet" /></a>
  <a href="#-stack"><img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" alt="Next.js 16" /></a>
  <a href="#-stack"><img src="https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript" alt="TypeScript" /></a>
  <a href="#-stack"><img src="https://img.shields.io/badge/Tailwind-4-38bdf8?style=flat-square&logo=tailwindcss" alt="Tailwind CSS" /></a>
  <a href="#-deployment"><img src="https://img.shields.io/badge/Cloudflare-Workers-f38020?style=flat-square&logo=cloudflare" alt="Cloudflare Workers" /></a>
</p>

<p align="center">
  Search Bitcoin transactions and addresses, inspect connected activity, and<br/>
  expand blockchain relationships hop by hop — all from a stunning glassmorphic interface.
</p>

<p align="center">
  <a href="https://blocklens.suwansankaja.com"><strong>🚀 Try it live →</strong></a>
</p>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔍 **Smart Search** | Paste any txid or Bitcoin address with auto-detection |
| 🕸️ **Interactive Graph** | Zoom, pan, drag, select, and expand nodes visually |
| 📊 **Transaction Details** | Inputs, outputs, outspends, and spending tx links |
| 🏠 **Address Mode** | Summary stats, recent transactions, neighbor addresses |
| 🔗 **Hop-by-Hop Expansion** | Controlled graph expansion up to 20 hops |
| 📋 **Details Panel** | Copy actions, external explorer links, collapsible sections |
| 🔗 **Shareable URLs** | Share any search via `/?q=<value>` |
| ⚡ **Session Cache** | In-memory caching for instant repeated lookups |
| 🔄 **API Fallback** | mempool.space → Blockstream Esplora automatic failover |
| ⚠️ **Smart Warnings** | Rate-limit, truncation, and heuristic warnings in the UI |

---

## 🛠️ Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS 4 |
| **Backend** | Next.js Route Handlers (BFF proxy) |
| **Graph Engine** | `vis-network` |
| **Deployment** | Cloudflare Workers (OpenNext) |

---

## 📁 Project Structure

```
app/
├── page.tsx                       # Main page
├── globals.css                    # Design system
└── api/
    ├── search/route.ts            # Unified search endpoint
    ├── tx/[txid]/route.ts         # Transaction lookup
    ├── address/[address]/route.ts # Address lookup
    └── expand/route.ts            # Graph expansion

components/
├── ExplorerApp.tsx                # Root app shell & state
├── SearchBar.tsx                  # Search input & detection
├── FiltersPanel.tsx               # Graph filter controls
├── SummaryCards.tsx               # Metric cards
├── GraphView.tsx                  # vis-network graph
└── DetailsPanel.tsx               # Node inspector

lib/
├── blockchain/                    # API adapters & provider logic
├── graph/                         # Graph construction & layouts
└── utils/                         # Validation & formatting

types/                             # TypeScript type definitions
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20+
- **npm** 9+

### Installation

```bash
# Clone the repo
git clone https://github.com/SuwanSankaja/BlockLens.git
cd BlockLens

# Install dependencies
npm install

# Create local env config
cp .env.example .env.local

# Start development
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and you're in 🎉

---

## ⚙️ Environment Variables

See [`.env.example`](.env.example) for the full list. Defaults point to Bitcoin mainnet public APIs — no external keys required.

---

## 🌐 Provider Architecture

```
mempool.space ──→ primary
                     │
                     ▼ (on failure)
Blockstream Esplora ──→ fallback
```

Both providers are interchangeable. The provider seam is cleanly abstracted in `lib/blockchain/`.

---

## 🕸️ Graph Model

```typescript
nodes: { id, type, label, raw, metadata }
edges: { id, from, to, type, value, metadata }
```

| Node Types | Edge Types |
|-----------|-----------|
| `transaction` | `input` · `output` |
| `address` | `spent_by` · `received_by` |

| Parameter | Value |
|-----------|-------|
| Default depth | 1 hop |
| Max expansion | 20 hops |
| Max visible nodes | 200 |

> ⚠️ **Input-side** address links are labeled as **heuristic** (inferred from prevout data, not ownership proof).

---

## ☁️ Deployment

Deployed on **Cloudflare Workers** via [OpenNext](https://opennext.js.org/).

```bash
npm run cf:build    # Build for Cloudflare
npm run preview     # Local preview
npm run deploy      # Deploy to production
```

---

## ⚠️ Limitations

| Limitation | Details |
|-----------|---------|
| 🚦 Rate limiting | Public APIs may throttle during high traffic |
| 📄 History depth | Address history is bounded by public endpoint limits |
| 🏷️ No clustering | No wallet clustering or entity attribution |
| 🔍 Heuristic links | Input-side relationships are inferred, not proven |
| 🌐 Mainnet only | Testnet/signet requires swapping base URLs |

---

## 📚 References

- [mempool.space REST API](https://mempool.space/docs/api/rest)
- [Blockstream Esplora API](https://github.com/Blockstream/esplora/blob/master/API.md)

---

<p align="center">
  <sub>Built with ❤️ by <a href="https://github.com/SuwanSankaja">Suwan Sankaja</a></sub>
</p>
