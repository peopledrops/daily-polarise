const ethers = require("ethers");
const axios = require("axios");
const fs = require("fs");
const { HttpsProxyAgent } = require("https-proxy-agent");

// --- GLOBAL ANTI-CRASH ---
process.on('unhandledRejection', (reason) => {
    if (reason.message && reason.message.includes('500')) {
        console.log('   ⚠️ RPC Polarise Sibuk (500), tetap melanjutkan...');
    }
});

process.on('uncaughtException', (err) => {
    console.log('   ⚠️ Sistem menangkap error fatal, bot tetap bertahan...');
});

// --- KONFIGURASI PROJECT POLARISE ---
const API_BASE = "https://apia.polarise.org/api/app/v1";
const POLARISE_RPC = "https://chainrpc.polarise.org";
const CHAIN_NAME = "polarise";
const TARGET_ADDRESS = "0x9c4324156ba59a70ffbc67b98ee2ef45aee4e19f";
const SEND_AMOUNT = "0.0001";
const TIP_AMOUNT = "0.00005";

const cryptoContent = {
    discussions: [{ title: "Strategic Yield on Polarise", desc: "Analyzing the best ways to maximize points daily." }],
    posts: [{ title: "Exploring Polarise L2", desc: "The speed and efficiency of Polarise is amazing for SocialFi." }],
    comments: ["Great project! Polarise ecosystem is growing fast. 🚀"]
};

let ProviderClass, WalletClass, parseUnits;
if (ethers.JsonRpcProvider) { 
    ProviderClass = ethers.JsonRpcProvider; WalletClass = ethers.Wallet; parseUnits = ethers.parseEther;
} else { 
    ProviderClass = ethers.providers.JsonRpcProvider; WalletClass = ethers.Wallet; parseUnits = ethers.utils.parseEther;
}

// --- FUNGSI API ---

async function completeTask(walletAddress, authToken, sessionId, taskId, agent, extraData = null) {
    const authHeader = `Bearer ${authToken} ${sessionId} ${walletAddress} ${CHAIN_NAME}`;
    const payload = { 
        user_wallet: walletAddress.toLowerCase(), 
        task_id: taskId, 
        chain_name: CHAIN_NAME, 
        extra_info: extraData ? JSON.stringify(extraData) : "{}" 
    };

    try { 
        const res = await axios.post(`${API_BASE}/points/completetask`, payload, { 
            headers: { 
                'Authorization': authHeader, 
                'accesstoken': sessionId,
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/plain, */*',
                'Origin': 'https://app.polarise.org',
                'Referer': 'https://app.polarise.org/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }, 
            httpsAgent: agent 
        }); 
        
        if (res.data.msg === "success") {
            console.log(`      ✅ Web Dashboard: Task ${taskId} Terverifikasi`);
            return true;
        }
        return false;
    } catch (e) { return false; }
}

async function getLatestPost(authToken, sessionId, walletAddress, agent) {
    const authHeader = `Bearer ${authToken} ${sessionId} ${walletAddress} ${CHAIN_NAME}`;
    const activeIds = [84002, 84500, 85110, 85500, 86000];
    try {
        const res = await axios.post(`${API_BASE}/posts/getposts`, 
            { chain_name: CHAIN_NAME, page: 1, limit: 10 }, 
            { headers: { 'Authorization': authHeader, 'accesstoken': sessionId }, httpsAgent: agent, timeout: 5000 }
        );
        const list = res.data.data?.list || [];
        const others = list.filter(p => p.wallet && p.wallet.toLowerCase() !== walletAddress.toLowerCase());
        if (others.length > 0) return { id: others[0].id, author: others[0].wallet };
        return { id: activeIds[Math.floor(Math.random() * activeIds.length)], author: TARGET_ADDRESS }; 
    } catch (e) { return { id: 84002, author: TARGET_ADDRESS }; }
}

async function runTasks(privateKey, proxyUrl) {
    const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : null;
    const provider = new ProviderClass(POLARISE_RPC);
    const wallet = new WalletClass(privateKey.trim(), provider);
    const sessionId = Math.random().toString(36).substring(2, 12);

    console.log(`\n[${wallet.address}] Memproses Akun Polarise...`);

    try {
        // --- LOGIN ---
        const nonceRes = await axios.post(`${API_BASE}/profile/getnonce`, { wallet: wallet.address, chain_name: CHAIN_NAME }, { headers: { 'accesstoken': sessionId }, httpsAgent: agent });
        const nonce = (nonceRes.data.signed_nonce || nonceRes.data.data.signed_nonce).trim();
        const sig = await wallet.signMessage(`Nonce to confirm: ${nonce}`);
        const loginRes = await axios.post(`${API_BASE}/profile/login`, { signature: sig, chain_name: CHAIN_NAME, name: wallet.address.substring(0,6), nonce, wallet: wallet.address, sid: sessionId }, { headers: { 'accesstoken': sessionId }, httpsAgent: agent });
        
        const token = loginRes.data.data.auth_token_info.auth_token;
        const profile = await axios.post(`${API_BASE}/profile/profileinfo`, { chain_name: CHAIN_NAME }, { headers: { 'Authorization': `Bearer ${token} ${sessionId} ${wallet.address} ${CHAIN_NAME}`, 'accesstoken': sessionId }, httpsAgent: agent });
        const userId = profile.data.data.id;
        const target = await getLatestPost(token, sessionId, wallet.address, agent);
        const auth = `Bearer ${token} ${sessionId} ${wallet.address} ${CHAIN_NAME}`;
        
        console.log(`   ✅ Login Berhasil (User ID: ${userId})`);

        // 1. ON-CHAIN INTERACTION (ID: 2)
        try {
            const tx = await wallet.sendTransaction({ to: TARGET_ADDRESS, value: parseUnits(SEND_AMOUNT), gasLimit: 21000 });
            console.log(`   💸 Transfer On-Chain Sukses...`);
            tx.wait().catch(() => {});
            await new Promise(r => setTimeout(r, 15000));
            await completeTask(wallet.address, token, sessionId, 2, agent, { tx_hash: tx.hash });
        } catch (e) { console.log(`   ❌ Transfer Gagal`); }

        // 2. TIP TASK (ID: 14)
        try {
            const tipTx = await wallet.sendTransaction({ to: target.author, value: parseUnits(TIP_AMOUNT), gasLimit: 21000 });
            tipTx.wait().catch(() => {});
            console.log(`   ⏳ Jeda Sinkronisasi (35 detik)...`);
            await new Promise(r => setTimeout(r, 35000));
            await axios.post(`${API_BASE}/posts/savetip`, { user_id: userId, post_id: target.id, tx_hash: tipTx.hash, amount: TIP_AMOUNT, chain_name: CHAIN_NAME }, { headers: { 'Authorization': auth, 'accesstoken': sessionId }, httpsAgent: agent });
            await completeTask(wallet.address, token, sessionId, 14, agent, { tx_hash: tipTx.hash });
        } catch (e) { console.log(`   ❌ Tip Gagal`); }

        // 3. SOCIAL TASKS (POST, DISCUSSION, COMMENT)
        try {
            const d = cryptoContent.discussions[0];
            await axios.post(`${API_BASE}/posts/savepost`, { user_id: userId, chain_name: CHAIN_NAME, title: `${d.title} #${Math.floor(Math.random()*999)}`, description: d.desc, published_time: Math.floor(Date.now()/1000), media_links: "[]", is_discussion: 1, category_id: 1 }, { headers: { 'Authorization': auth, 'accesstoken': sessionId }, httpsAgent: agent });
            await completeTask(wallet.address, token, sessionId, 12, agent);

            const p = cryptoContent.posts[0];
            await axios.post(`${API_BASE}/posts/savepost`, { user_id: userId, chain_name: CHAIN_NAME, title: `${p.title} ${Math.floor(Date.now()/1000)}`, description: p.desc, published_time: Math.floor(Date.now()/1000), media_links: "[]", is_discussion: 0 }, { headers: { 'Authorization': auth, 'accesstoken': sessionId }, httpsAgent: agent });
            await completeTask(wallet.address, token, sessionId, 8, agent);

            await axios.post(`${API_BASE}/posts/savecomment`, { user_id: userId, post_id: target.id, content: cryptoContent.comments[0], published_time: Math.floor(Date.now()/1000), chain_name: CHAIN_NAME }, { headers: { 'Authorization': auth, 'accesstoken': sessionId }, httpsAgent: agent });
            await completeTask(wallet.address, token, sessionId, 10, agent);
            console.log(`   ✅ Semua Tugas Sosial Selesai`);
        } catch (e) {}

    } catch (error) { console.log(`   ❌ Akun ini mengalami gangguan server (500).`); }
}

async function main() {
    console.log("=========================================");
    console.log("   POLARISE DAILY BOT - ULTRA SYNC v10.9");
    console.log("=========================================");
    const rawContent = fs.readFileSync("pk.txt", "utf8");
    const pks = rawContent.replace(/\r/g, "").split("\n").map(l => l.trim()).filter(l => l.length > 30);
    console.log(`[System] Memproses ${pks.length} akun Polarise...`);
    for (let i = 0; i < pks.length; i++) {
        await runTasks(pks[i], null);
        if (i < pks.length - 1) await new Promise(r => setTimeout(r, 20000));
    }
    console.log("\n=========================================");
    console.log("       SEMUA PROSES SELESAI");
    console.log("=========================================");
}
main();