const https = require('https');
const querystring = require('querystring');

function postJson(url, data, extraHeaders = {}) {
	return new Promise((resolve, reject) => {
		const payload = Buffer.from(JSON.stringify(data));
		const u = new URL(url);
		const req = https.request({
			hostname: u.hostname,
			path: u.pathname + u.search,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': payload.length,
				'Accept': 'application/json, text/plain, */*',
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				'Origin': 'https://agent.ifun7.vip',
				'Referer': 'https://agent.ifun7.vip/',
				...extraHeaders
			}
		}, (res) => {
			let chunks = '';
			res.setEncoding('utf8');
			res.on('data', (c) => chunks += c);
			res.on('end', () => {
				try { resolve({ status: res.statusCode, body: JSON.parse(chunks) }); } catch { resolve({ status: res.statusCode, body: chunks }); }
			});
		});
		req.on('error', reject);
		req.write(payload);
		req.end();
	});
}

function postForm(url, data, extraHeaders = {}) {
	return new Promise((resolve, reject) => {
		const payload = Buffer.from(querystring.stringify(data));
		const u = new URL(url);
		const req = https.request({
			hostname: u.hostname,
			path: u.pathname + u.search,
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Content-Length': payload.length,
				'Accept': 'application/json, text/plain, */*',
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				'Origin': 'https://agent.ifun7.vip',
				'Referer': 'https://agent.ifun7.vip/',
				...extraHeaders
			}
		}, (res) => {
			let chunks = '';
			res.setEncoding('utf8');
			res.on('data', (c) => chunks += c);
			res.on('end', () => {
				try { resolve({ status: res.statusCode, body: JSON.parse(chunks) }); } catch { resolve({ status: res.statusCode, body: chunks }); }
			});
		});
		req.on('error', reject);
		req.write(payload);
		req.end();
	});
}

(async () => {
	const url = 'https://agent.ifun7.vip/loginAndRegister';
	const body = {
		lng: 'en',
		lang: 'en',
		platform: 'IDN',
		game_id: 1001,
		account: '160745893.DWBTTW12',
		agent_id: 'IDN_AGENT1',
		token: 'MTczMzcyODgyMzk0MzU2NDI4OAjACTFqgHNHkMSrUHlVpOOgOSvGoFkcxdLlJZMq'
	};
	try {
		const jsonRes = await postJson(url, body);
		console.log('JSON response:');
		console.log(JSON.stringify(jsonRes, null, 2));
		if (jsonRes.status >= 400) {
			const formRes = await postForm(url, body);
			console.log('Form response:');
			console.log(JSON.stringify(formRes, null, 2));
		}
	} catch (err) {
		console.error('REQUEST_ERROR:', err.message);
	}
})();


