let currentRpcIndex = 0;
let rpcEndpoints = [];

function getNextRpcEndpoint() {
    if (!rpcEndpoints.length) {
        throw new Error('No RPC endpoints available');
    }
    const endpoint = rpcEndpoints[currentRpcIndex];
    currentRpcIndex = (currentRpcIndex + 1) % rpcEndpoints.length;
    return endpoint;
}

async function fetchRPC(body) {
    const endpoint = getNextRpcEndpoint();
    
    const bodyStr = Buffer.isBuffer(body) ? body.toString() : body;
    const bodyData = typeof bodyStr === 'string' ? bodyStr : JSON.stringify(bodyStr);
    
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyData
    });
    return response.json();
}

function setRpcEndpoints(endpoints) {
    rpcEndpoints = [...endpoints];
}

module.exports = {
    fetchRPC,
    setRpcEndpoints
};