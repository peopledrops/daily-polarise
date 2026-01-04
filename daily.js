const ethers = require("ethers");
const axios = require("axios");
const fs = require("fs");
const { HttpsProxyAgent } = require("https-proxy-agent");

// --- KONFIGURASI ---
const API_BASE = "https://apia.polarise.org/api/app/v1";
const POLARISE_RPC = "https://chainrpc.polarise.org";
const CHAIN_NAME = "polarise";
const TARGET_ADDRESS = "0x9c4324156ba59a70ffbc67b98ee2ef45aee4e19f";
const SEND_AMOUNT = "0.0001";
const TIP_AMOUNT = "0.00005";

const cryptoContent = {
    posts: [{ title: "L2 Social Layer", desc: "Building decentralized social interactions on Polarise." }],
    discussions: [{ title: "Next Bull Meta", desc: "Will AI-Agents lead the next cycle in 2026?" }],
    comments: ["Great insight!", "LFG! 🚀", "Supportive community."]
};

let ProviderClass, WalletClass, formatUnits;
if (ethers.providers && ethers.providers.JsonRpcProvider) {
    ProviderClass = ethers.providers.JsonRpcProvider; WalletClass = ethers.Wallet; formatUnits = ethers.utils.parseEther;
} else if (ethers.JsonRpcProvider) {
    ProviderClass = ethers.JsonRpcProvider; WalletClass = ethers.Wallet; formatUnits = ethers.parseEther;
} else {
    const eth = ethers.ethers || ethers;
    ProviderClass = eth.JsonRpcProvider || eth.providers.JsonRpcProvider; WalletClass = eth.Wallet; formatUnits = eth.parseEther || eth.utils.parseEther;
}

// --- FUNGSI API ---

async function getLatestPost(authToken, sessionId, walletAddress, agent) {
    const authHeader = `Bearer ${authToken} ${sessionId} ${walletAddress} ${CHAIN_NAME}`;
    try {
        const res = await axios.post(`${API_BASE}/posts/getposts`, 
            { chain_name: CHAIN_NAME, page: 1, limit: 100 }, 
            { headers: { 'Authorization': authHeader, 'accesstoken': sessionId }, httpsAgent: agent, timeout: 8000 }
        );
        const list = res.data.data?.list || [];
        const others = list.filter(p => p.wallet.toLowerCase() !== walletAddress.toLowerCase() && p.wallet.startsWith("0x"));
        if (others.length > 0) {
            const pick = others[Math.floor(Math.random() * Math.min(others.length, 20))];
            return { id: pick.id, author: pick.wallet };
        }
        // Jika gagal total mencari post asli, gunakan ID acak agar tidak terkena limit di ID yang sama
        const randomId = Math.floor(Math.random() * (79000 - 77000) + 77000);
        return { id: randomId, author: TARGET_ADDRESS };
    } catch (e) {
        const randomId = Math.floor(Math.random() * (79000 - 77000) + 77000);
        return { id: randomId, author: TARGET_ADDRESS };
    }
}

async function completeTask(walletAddress, authToken, sessionId, taskId, agent, extraData = null) {
    const authHeader = `Bearer ${authToken} ${sessionId} ${walletAddress} ${CHAIN_NAME}`;
    const payload = { user_wallet: walletAddress, task_id: taskId, chain_name: CHAIN_NAME, extra_info: extraData ? JSON.stringify(extraData) : null };
    try { await axios.post(`${API_BASE}/points/completetask`, payload, { headers: { 'Authorization': authHeader, 'accesstoken': sessionId }, httpsAgent: agent }); return true; } catch (e) { return false; }
}

async function runTasks(privateKey, proxyUrl) {
    const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : null;
    const provider = new ProviderClass(POLARISE_RPC);
    const wallet = new WalletClass(privateKey, provider);
    const sessionId = (ethers.hexlify && ethers.randomBytes) ? ethers.hexlify(ethers.randomBytes(16)) : ethers.utils.hexlify(ethers.utils.randomBytes(16));

    console.log(`\n[${wallet.address}] Memulai tugas...`);

    try {
        const nonceRes = await axios.post(`${API_BASE}/profile/getnonce`, { wallet: wallet.address, chain_name: CHAIN_NAME }, { headers: { 'accesstoken': sessionId }, httpsAgent: agent });
        const nonce = (nonceRes.data.signed_nonce || nonceRes.data.data.signed_nonce).trim();
        const sig = await wallet.signMessage(`Nonce to confirm: ${nonce}`);
        const loginRes = await axios.post(`${API_BASE}/profile/login`, { signature: sig, chain_name: CHAIN_NAME, name: wallet.address.substring(0,6), nonce, wallet: wallet.address, sid: sessionId }, { headers: { 'accesstoken': sessionId }, httpsAgent: agent });
        const token = loginRes.data.data.auth_token_info.auth_token;
        console.log(`   ✅ Login Berhasil`);
        
        const profile = await axios.post(`${API_BASE}/profile/profileinfo`, { chain_name: CHAIN_NAME }, { headers: { 'Authorization': `Bearer ${token} ${sessionId} ${wallet.address} ${CHAIN_NAME}`, 'accesstoken': sessionId }, httpsAgent: agent });
        const userId = profile.data.data.id;
        const target = await getLatestPost(token, sessionId, wallet.address, agent);

        // 1. Daily Transfer
        const tx = await wallet.sendTransaction({ to: TARGET_ADDRESS, value: formatUnits(SEND_AMOUNT) });
        await tx.wait();
        await new Promise(r => setTimeout(r, 5000));
        await completeTask(wallet.address, token, sessionId, 2, agent, { tx_hash: tx.hash });
        console.log(`   ✅ Task Transfer Selesai`);

        // 2. Tip (With Retry & Random Target)
        console.log(`   💸 Mengirim Tip ke ID ${target.id}...`);
        try {
            const tipTx = await wallet.sendTransaction({ to: target.author, value: formatUnits(TIP_AMOUNT) });
            await tipTx.wait();
            console.log(`   ⏳ Jeda Sinkronisasi (20 detik)...`);
            await new Promise(r => setTimeout(r, 20000));

            const authHeader = `Bearer ${token} ${sessionId} ${wallet.address} ${CHAIN_NAME}`;
            await axios.post(`${API_BASE}/posts/savetip`, { user_id: userId, post_id: target.id, tx_hash: tipTx.hash, amount: TIP_AMOUNT, chain_name: CHAIN_NAME }, { headers: { 'Authorization': authHeader, 'accesstoken': sessionId }, httpsAgent: agent });
            await completeTask(wallet.address, token, sessionId, 14, agent, { tx_hash: tipTx.hash });
            console.log(`   ✅ Task Tip Berhasil`);
        } catch (e) { console.log(`   ❌ Tip Gagal: ${e.response?.data?.msg || "Server Busy"}`); }

        // 3. Social Tasks
        const auth = `Bearer ${token} ${sessionId} ${wallet.address} ${CHAIN_NAME}`;
        try {
            const d = cryptoContent.discussions[0];
            await axios.post(`${API_BASE}/posts/savepost`, { user_id: userId, chain_name: CHAIN_NAME, title: `${d.title} #${Math.floor(Math.random()*999)}`, description: d.desc, published_time: Math.floor(Date.now()/1000), media_links: "[]", is_discussion: 1, category_id: 1 }, { headers: { 'Authorization': auth, 'accesstoken': sessionId }, httpsAgent: agent });
            await completeTask(wallet.address, token, sessionId, 12, agent);
            const p = cryptoContent.posts[0];
            await axios.post(`${API_BASE}/posts/savepost`, { user_id: userId, chain_name: CHAIN_NAME, title: `${p.title} ${Math.floor(Date.now()/1000)}`, description: p.desc, published_time: Math.floor(Date.now()/1000), media_links: "[]", is_discussion: 0 }, { headers: { 'Authorization': auth, 'accesstoken': sessionId }, httpsAgent: agent });
            await completeTask(wallet.address, token, sessionId, 8, agent);
            console.log(`   ✅ Task Social Selesai`);
        } catch (e) {}

        // Comment
        try {
            await axios.post(`${API_BASE}/posts/savecomment`, { user_id: userId, post_id: target.id, content: cryptoContent.comments[0], published_time: Math.floor(Date.now()/1000), chain_name: CHAIN_NAME }, { headers: { 'Authorization': auth, 'accesstoken': sessionId }, httpsAgent: agent });
            await completeTask(wallet.address, token, sessionId, 10, agent);
            console.log(`   ✅ Task Comment Selesai`);
        } catch (e) {}

    } catch (error) { console.error(`   ❌ Error: ${error.message}`); }
}

async function main() {
    console.log("=========================================");
    console.log("   POLARISE DAILY BOT - FINAL STABLE v9");
    console.log("=========================================");
    const pks = fs.readFileSync("pk.txt", "utf8").split("\n").filter(line => line.trim());
    for (let i = 0; i < pks.length; i++) {
        await runTasks(pks[i].trim(), null);
        if (i < pks.length - 1) await new Promise(r => setTimeout(r, 10000));
    }
}
main();