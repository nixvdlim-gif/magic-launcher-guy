
-- Add new transaction types
ALTER TYPE txn_type ADD VALUE IF NOT EXISTS 'transfer_in';
ALTER TYPE txn_type ADD VALUE IF NOT EXISTS 'transfer_out';
