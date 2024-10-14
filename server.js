const express = require('express');
const { Web3 } = require('web3');

const app = express();
const PORT = process.env.PORT || 3000;

const wsProvider = new Web3.providers.WebsocketProvider(
    'wss://mainnet.infura.io/ws/v3/4483d8c8f56445eebf2899f66639ce5b'
);
const web3 = new Web3(wsProvider);

const recentTransactions = [];
const MAX_TRANSACTION_HISTORY = 100;

function predictFraud(features) {
    // Placeholder fraud prediction logic: Adjust as needed
    return Math.random() < 0.2;
}

// Calculate transaction features for an address
async function calculateFeatures(address) {
    try {
        const [transactionCount, balance] = await Promise.all([
            web3.eth.getTransactionCount(address),
            web3.eth.getBalance(address),
        ]);

        let totalSent = 0,
            totalReceived = 0,
            sentCount = 0,
            receivedCount = 0,
            totalSentTimeDiff = 0,
            totalReceivedTimeDiff = 0;

        const currentTime = Date.now();

        // Analyze transaction history for the given address
        recentTransactions.forEach((tx) => {
            const timeDiff = (currentTime - tx.timestamp) / (1000 * 60); // Time diff in minutes

            if (tx.from.toLowerCase() === address.toLowerCase()) {
                totalSent += parseFloat(tx.value);
                totalSentTimeDiff += timeDiff;
                sentCount++;
            } else if (tx.to.toLowerCase() === address.toLowerCase()) {
                totalReceived += parseFloat(tx.value);
                totalReceivedTimeDiff += timeDiff;
                receivedCount++;
            }
        });

        const avgMinBetweenSentTx = sentCount > 0 ? totalSentTimeDiff / sentCount : 0;
        const avgMinBetweenReceivedTx = receivedCount > 0 ? totalReceivedTimeDiff / receivedCount : 0;
        const timeDiffFirstLast = recentTransactions.length > 0 
            ? (currentTime - recentTransactions[0].timestamp) / (1000 * 60)
            : 0;

        return {
            'Transaction Count': transactionCount,
            'Current Ether Balance': web3.utils.fromWei(balance, 'ether'),
            'Avg Min Between Sent Tx': avgMinBetweenSentTx,
            'Avg Min Between Received Tx': avgMinBetweenReceivedTx,
            'Time Diff First to Last (Mins)': timeDiffFirstLast,
            'Total Sent Tx': sentCount,
            'Total Received Tx': receivedCount,
            'Total Ether Sent': totalSent,
            'Total Ether Received': totalReceived,
        };
    } catch (error) {
        console.error(`Error calculating features for ${address}:, error`);
        return {};
    }
}

// Process transactions in a block
async function processNewBlock(blockNumber) {
    try {
        console.log(`Processing block: ${blockNumber}`);
        const block = await web3.eth.getBlock(blockNumber, true);
        if (!block) {
            console.log(`Block ${blockNumber} not found`);
            return;
        }

        for (const tx of block.transactions) {
            const newTransaction = {
                hash: tx.hash,
                from: tx.from,
                to: tx.to,
                value: web3.utils.fromWei(tx.value, 'ether'),
                timestamp: Date.now(),
            };

            // Add new transaction to history and maintain size
            recentTransactions.push(newTransaction);
            if (recentTransactions.length > MAX_TRANSACTION_HISTORY) {
                recentTransactions.shift();
            }

            const [senderFeatures, receiverFeatures] = await Promise.all([
                calculateFeatures(tx.from),
                calculateFeatures(tx.to),
            ]);

            const isSenderFraudulent = predictFraud(senderFeatures);
            const isReceiverFraudulent = predictFraud(receiverFeatures);

            console.log(`Transaction: ${newTransaction.hash}`);
            console.log(`Sender (${tx.from}) fraudulent: ${isSenderFraudulent}`);
            console.log(`Receiver (${tx.to}) fraudulent: ${isReceiverFraudulent}`);
            console.log('Sender Features:', senderFeatures);
            console.log('Receiver Features:', receiverFeatures);
            console.log('---');
        }
    } catch (error) {
        console.error('Error processing block:', error);
    }
}

// Subscribe to new block headers via WebSocket
async function subscribeToNewBlocks() {
    try {
        console.log('Subscribing to new blocks...');
        const subscription = await web3.eth.subscribe('newBlockHeaders');

        subscription.on('data', async (blockHeader) => {
            await processNewBlock(blockHeader.number);
        });

        subscription.on('error', (error) => {
            console.error('Subscription error:', error);
            setTimeout(subscribeToNewBlocks, 5000);
        });

        console.log('Successfully subscribed to new blocks');
    } catch (error) {
        console.error('Error subscribing to new blocks:', error);
        fallbackToPolling();
    }
}

// Fallback polling mechanism if WebSocket fails
async function fallbackToPolling() {
    console.log('Falling back to polling for new blocks...');
    let lastProcessedBlock = await web3.eth.getBlockNumber();

    setInterval(async () => {
        try {
            const currentBlock = await web3.eth.getBlockNumber();
            if (currentBlock > lastProcessedBlock) {
                for (let i = lastProcessedBlock + 1; i <= currentBlock; i++) {
                    await processNewBlock(i);
                }
                lastProcessedBlock = currentBlock;
            }
        } catch (error) {
            console.error('Error in polling:', error);
        }
    }, 15000);
}

// Handle WebSocket connection errors and reconnections
wsProvider.on('error', (error) => {
    console.error('WebSocket error:', error);
    fallbackToPolling();
});

wsProvider.on('end', () => {
    console.log('WebSocket connection closed. Reconnecting...');
    setTimeout(subscribeToNewBlocks, 5000);
});

// Start the subscription to new blocks
subscribeToNewBlocks();

// Start the Express server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
