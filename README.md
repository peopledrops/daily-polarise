# 🐧 Polarise Daily Tasks Bot

Automate your daily engagement tasks on the **Polarise** platform with this Node.js bot. It handles on-chain interactions, content creation (posts & discussions), commenting, and user subscriptions — all automatically!

---

## 📦 Features

- ✅ **Daily On-Chain Interaction** (small ETH/LUNA transfer)
- ✅ **Create Crypto Discussion** with randomized topics
- ✅ **Create Educational Post** with real crypto insights
- ✅ **Post a Smart Comment** on existing content
- ✅ **Subscribe to Random Users** from the feed
- 🔁 **Automatic retry logic** for resilient task execution
- 🌐 **Proxy support** for IP rotation (optional)
- ⚙️ **Multi-account support** via private key list

---

## 🛠️ Requirements

- Node.js (v16 or higher)
- `npm` or `yarn`
- Private keys of your Polarise accounts (one per line)
- (Optional) Proxy list for enhanced privacy

---

## ⚙️ Installation

1. **Clone or download** this repository.
2. Install dependencies:
   ```bash
   npm install ethers axios https-proxy-agent fs
   ```
3. Prepare your files:
   - `pk.txt`: Paste one private key per line.
   - `proxy.txt` *(optional)*: One proxy per line in `http://ip:port` or `http://user:pass@ip:port` format.

---

## 📄 File Structure

```
polarise-bot/
├── daily.js               # Main script
├── pk.txt               # Private keys (required)
├── proxy.txt            # Proxies (optional)
└── README.md
```

> ⚠️ **Security Note**: Never commit `pk.txt` or `proxy.txt` to version control! Add them to `.gitignore`.

---

## 🔧 Configuration

You can adjust these settings in the script (`bot.js`):

| Parameter | Description |
|----------|-------------|
| `SEND_AMOUNT` | Amount to send (in Wei); default = `0.001 LUNA` |
| `TARGET_ADDRESS` | Recipient address for on-chain tasks |
| `USE_PROXY` | Set to `true`/`false` (auto-detected if `proxy.txt` exists) |
| `API_BASE` / `POLARISE_RPC` | Polarise API & RPC endpoints |

> 💡 The crypto content (posts, discussions, comments) is auto-generated from a curated list of real Web3 topics.

---

## ▶️ Usage

Run the bot:

```bash
node daily.js
```

The bot will:
1. Log in to each account
2. Execute all 5 daily tasks
3. Display success/failure per account
4. Show a final summary

---

## 🔄 Daily Tasks Overview

| Task ID | Action | Details |
|--------|--------|--------|
| 2 | On-chain Interaction | Sends 0.001 LUNA to a target address |
| 7 | Create Discussion | Random crypto poll with 2 options |
| 8 | Create Post | Educational article with title & description |
| 10 | Comment | Adds a smart comment to a sample post |
| 11 | Subscribe | Follows a random active user |

---

## 🌐 Proxy Support

- Place proxies in `proxy.txt` (one per line)
- Supports `HTTP` and `HTTPS` proxies
- Automatically rotates proxies per account
- Falls back to direct connection if all proxies fail

---

## ⚠️ Disclaimer

- This tool is for **educational and testing purposes only**.
- Use at your own risk. The author is not responsible for any loss of funds.
- Ensure you understand the tasks before running (especially on-chain transactions).
- Do not use on mainnet without thorough testing.

---

## 🧑‍💻 Author

Made with ❤️ by [DONTOL](https://t.me/FxcTe) X [@adfmidn](https://t.me/AirdropFamilyIDN)

---

> ✨ **Pro Tip**: Run this daily via cron job or cloud scheduler to maintain consistent engagement and earn points!
