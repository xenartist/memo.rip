#!/bin/bash

# Configuration
VOTE_ADDRESS="VOTE_ADDRESS"
REWARD_ADDRESS="REWARD_ADDRESS"
RATIO=0.9  # 90% to reward address
RPC_URL="RPC_URL"
MIN_BALANCE=0.03 

# Set RPC URL
solana config set --url $RPC_URL --keypair ~/.config/solana/withdrawer.json

# Get vote account balance
VOTE_BALANCE=$(solana balance $VOTE_ADDRESS --keypair ~/.config/solana/withdrawer.json | awk '{print $1}')
if [ -z "$VOTE_BALANCE" ]; then
    echo "Error: Could not get vote account balance"
    exit 1
fi

# Clean up balance string
VOTE_BALANCE=${VOTE_BALANCE/SOL/}
VOTE_BALANCE=$(echo $VOTE_BALANCE | tr -d '[:space:]')

# Calculate withdrawable balance
WITHDRAWABLE_BALANCE=$(awk "BEGIN {printf \"%.9f\", $VOTE_BALANCE - $MIN_BALANCE}")

# Calculate amounts in SOL
REWARD_AMOUNT=$(awk "BEGIN {printf \"%.9f\", $WITHDRAWABLE_BALANCE * $RATIO}")
REMAINING_AMOUNT=$(awk "BEGIN {printf \"%.9f\", $WITHDRAWABLE_BALANCE - $REWARD_AMOUNT}")

# Show initial state
echo "Initial state:"
echo "Vote account balance: $VOTE_BALANCE SOL"
echo "Withdrawable balance: $WITHDRAWABLE_BALANCE SOL"
echo "Amount to reward address (80%): $REWARD_AMOUNT SOL"
echo "Amount to withdrawer (20%): $REMAINING_AMOUNT SOL"

# Withdraw to reward address
echo -e "\nWithdrawing $REWARD_AMOUNT SOL to reward address..."
RESULT=$(solana withdraw-from-vote-account --authorized-withdrawer ~/.config/solana/withdrawer.json \
    $VOTE_ADDRESS $REWARD_ADDRESS $REWARD_AMOUNT)
if [ $? -ne 0 ]; then
    echo "Error during first withdrawal: $RESULT"
    exit 1
fi

echo -e "\nWaiting 60 seconds before second withdrawal..."
sleep 60

# Withdraw remaining to withdrawer
echo -e "\nWithdrawing $REMAINING_AMOUNT SOL to withdrawer..."
RESULT=$(solana withdraw-from-vote-account --authorized-withdrawer ~/.config/solana/withdrawer.json \
    $VOTE_ADDRESS $(solana-keygen pubkey ~/.config/solana/withdrawer.json) $REMAINING_AMOUNT)
if [ $? -ne 0 ]; then
    echo "Error during second withdrawal: $RESULT"
    exit 1
fi

# Show final balances
echo -e "\nFinal state:"
echo "Vote account balance: $(solana balance $VOTE_ADDRESS --keypair ~/.config/solana/withdrawer.json) SOL"
echo "Reward address balance: $(solana balance $REWARD_ADDRESS --keypair ~/.config/solana/withdrawer.json) SOL"
echo "Withdrawer balance: $(solana balance $(solana-keygen pubkey ~/.config/solana/withdrawer.json) --keypair ~/.config/solana/withdrawer.json) SOL"